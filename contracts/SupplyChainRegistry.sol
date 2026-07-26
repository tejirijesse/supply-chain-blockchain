// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title SupplyChainRegistry
 * @author Supply Chain Blockchain Project
 * @notice A provenance and traceability registry for physical products.
 *
 * @dev  Mission: "Transparency & Trust".
 *
 *       This contract fights counterfeiting and opaque supply chains by recording
 *       every product and every custody change on-chain, where the history is
 *       tamper-proof and publicly auditable. Anyone can independently verify:
 *         - who manufactured a product,
 *         - who has held it at every step, and
 *         - what lifecycle stage it is currently in.
 *
 *       Design overview
 *       ---------------
 *       - Role-based access control gates who may perform sensitive actions.
 *         The deployer becomes the `admin`. The admin registers trusted
 *         participants (manufacturers, distributors, retailers).
 *       - Only registered manufacturers may create ("register") new products.
 *       - Custody moves forward through a strict lifecycle so history cannot be
 *         silently rewritten (Created -> Manufactured -> InTransit -> Delivered -> Sold).
 *       - Every custody transfer appends an immutable record to the product's
 *         history, giving a complete provenance trail.
 *       - Events are emitted for every state change so off-chain systems (dApps,
 *         indexers) can react and display the audit trail.
 */
contract SupplyChainRegistry {
    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    /// @notice Roles a participant can hold in the supply chain.
    /// @dev `None` (default 0) means the address is not a registered participant.
    enum Role {
        None,
        Manufacturer,
        Distributor,
        Retailer
    }

    /// @notice Lifecycle stages a product moves through, in order.
    /// @dev Stages only advance forward; they can never move backward. This
    ///      guarantees an append-only, tamper-evident lifecycle.
    enum Stage {
        Created, // 0: product record created by a manufacturer
        Manufactured, // 1: production finished, ready to ship
        InTransit, // 2: handed to a distributor / in movement
        Delivered, // 3: received by a retailer
        Sold // 4: sold to end customer (terminal stage)
    }

    /// @notice A single custody hand-off, stored to build the provenance trail.
    struct CustodyRecord {
        address holder; // who received custody at this step
        Stage stage; // the lifecycle stage set at this step
        uint256 timestamp; // block time when custody was recorded
    }

    /// @notice Core data describing a product tracked by the registry.
    struct Product {
        uint256 id; // unique, sequential identifier
        string name; // human-readable product name
        string details; // free-form metadata (batch, description, etc.)
        address manufacturer; // address that registered the product
        address currentHolder; // who currently holds custody
        Stage stage; // current lifecycle stage
        uint256 createdAt; // block time of registration
        bool exists; // guard flag: true once registered
    }

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    /// @notice Contract administrator (set to the deployer). Manages participants.
    address public immutable admin;

    /// @notice Auto-incrementing counter; also the total number of products created.
    uint256 public productCount;

    /// @notice Maps a participant address to its assigned role.
    mapping(address => Role) public roles;

    /// @notice Maps a product id to its core data.
    mapping(uint256 => Product) private products;

    /// @notice Maps a product id to its ordered list of custody records.
    mapping(uint256 => CustodyRecord[]) private history;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /// @notice Emitted when the admin assigns a role to a participant.
    event ParticipantRegistered(address indexed participant, Role role);

    /// @notice Emitted when the admin removes a participant.
    event ParticipantRemoved(address indexed participant);

    /// @notice Emitted when a new product is registered by a manufacturer.
    event ProductRegistered(
        uint256 indexed productId,
        string name,
        address indexed manufacturer
    );

    /// @notice Emitted on every custody transfer / stage advance.
    event CustodyTransferred(
        uint256 indexed productId,
        address indexed from,
        address indexed to,
        Stage stage
    );

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    /// @dev Restricts a function to the contract administrator.
    modifier onlyAdmin() {
        require(msg.sender == admin, "Not authorized: admin only");
        _;
    }

    /// @dev Restricts a function to callers holding a specific role.
    modifier onlyRole(Role required) {
        require(roles[msg.sender] == required, "Not authorized: wrong role");
        _;
    }

    /// @dev Reverts if the referenced product has never been registered.
    modifier productExists(uint256 productId) {
        require(products[productId].exists, "Product does not exist");
        _;
    }

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @notice Deploys the registry and records the deployer as admin.
    constructor() {
        admin = msg.sender;
    }

    // -------------------------------------------------------------------------
    // Participant management (admin only)
    // -------------------------------------------------------------------------

    /**
     * @notice Registers a participant with a role.
     * @param participant Address to authorize.
     * @param role Role to grant (must not be `Role.None`).
     */
    function registerParticipant(address participant, Role role)
        external
        onlyAdmin
    {
        require(participant != address(0), "Zero address");
        require(role != Role.None, "Invalid role");
        roles[participant] = role;
        emit ParticipantRegistered(participant, role);
    }

    /**
     * @notice Revokes a participant's role.
     * @param participant Address to de-authorize.
     */
    function removeParticipant(address participant) external onlyAdmin {
        require(roles[participant] != Role.None, "Not a participant");
        roles[participant] = Role.None;
        emit ParticipantRemoved(participant);
    }

    // -------------------------------------------------------------------------
    // Product lifecycle
    // -------------------------------------------------------------------------

    /**
     * @notice Registers a new product. Only registered manufacturers may call.
     * @param name Human-readable product name.
     * @param details Free-form metadata (batch number, description, etc.).
     * @return productId The new product's unique identifier.
     */
    function registerProduct(string calldata name, string calldata details)
        external
        onlyRole(Role.Manufacturer)
        returns (uint256 productId)
    {
        require(bytes(name).length > 0, "Name required");

        productId = ++productCount; // ids start at 1

        products[productId] = Product({
            id: productId,
            name: name,
            details: details,
            manufacturer: msg.sender,
            currentHolder: msg.sender,
            stage: Stage.Created,
            createdAt: block.timestamp,
            exists: true
        });

        // Seed the provenance trail with the manufacturer's initial custody.
        history[productId].push(
            CustodyRecord({
                holder: msg.sender,
                stage: Stage.Created,
                timestamp: block.timestamp
            })
        );

        emit ProductRegistered(productId, name, msg.sender);
    }

    /**
     * @notice Transfers custody of a product to the next holder and advances
     *         its lifecycle stage by exactly one step.
     * @dev    Enforced rules:
     *         - Caller must be the product's current holder.
     *         - `newStage` must be exactly one greater than the current stage
     *           (no skipping and no moving backward).
     *         - A product in the terminal `Sold` stage cannot be transferred.
     *         - The receiving address must hold the role expected for the new
     *           lifecycle stage, preserving real-world custody semantics.
     * @param productId Product to transfer.
     * @param to Address receiving custody (must be a registered participant).
     * @param newStage The next lifecycle stage.
     */
    function transferCustody(
        uint256 productId,
        address to,
        Stage newStage
    ) external productExists(productId) {
        Product storage p = products[productId];

        require(msg.sender == p.currentHolder, "Only current holder");
        require(to != address(0), "Zero address");
        require(roles[to] != Role.None, "Recipient not a participant");
        require(p.stage != Stage.Sold, "Product already sold");
        require(
            uint8(newStage) == uint8(p.stage) + 1,
            "Stage must advance by one"
        );
        require(
            roles[to] == expectedRoleForStage(newStage),
            "Recipient role does not match stage"
        );

        address from = p.currentHolder;
        p.currentHolder = to;
        p.stage = newStage;

        history[productId].push(
            CustodyRecord({
                holder: to,
                stage: newStage,
                timestamp: block.timestamp
            })
        );

        emit CustodyTransferred(productId, from, to, newStage);
    }

    /**
     * @dev Maps each post-creation lifecycle stage to the participant role that
     *      should hold custody at that point.
     */
    function expectedRoleForStage(Stage stage) internal pure returns (Role) {
        if (stage == Stage.Manufactured) {
            return Role.Manufacturer;
        }
        if (stage == Stage.InTransit) {
            return Role.Distributor;
        }
        if (stage == Stage.Delivered || stage == Stage.Sold) {
            return Role.Retailer;
        }
        return Role.None;
    }

    // -------------------------------------------------------------------------
    // Views (provenance & verification)
    // -------------------------------------------------------------------------

    /**
     * @notice Returns the full core data for a product.
     * @param productId Product to read.
     */
    function getProduct(uint256 productId)
        external
        view
        productExists(productId)
        returns (Product memory)
    {
        return products[productId];
    }

    /**
     * @notice Returns the complete, ordered custody history of a product.
     * @dev    This is the provenance trail used to independently verify origin
     *         and chain of custody.
     * @param productId Product to read.
     */
    function getHistory(uint256 productId)
        external
        view
        productExists(productId)
        returns (CustodyRecord[] memory)
    {
        return history[productId];
    }

    /**
     * @notice Returns how many custody records a product has.
     * @param productId Product to read.
     */
    function getHistoryLength(uint256 productId)
        external
        view
        productExists(productId)
        returns (uint256)
    {
        return history[productId].length;
    }

    /**
     * @notice Verifies whether an address is the original manufacturer of a
     *         product — a simple authenticity check for buyers.
     * @param productId Product to check.
     * @param claimedManufacturer Address whose authenticity is being verified.
     * @return true if `claimedManufacturer` registered the product.
     */
    function verifyAuthenticity(uint256 productId, address claimedManufacturer)
        external
        view
        productExists(productId)
        returns (bool)
    {
        return products[productId].manufacturer == claimedManufacturer;
    }
}
