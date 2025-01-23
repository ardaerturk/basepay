// intersend-connector.js

/**
 * IntersendProvider class implements a Web3 provider interface for iframe-embedded apps
 * Handles wallet connection, transactions, and messaging between parent and child frames
 */
class IntersendProvider {
  constructor() {
    // Initialize provider state
    this._state = {
      accounts: [],
      isConnected: false,
      chainId: '0x89', // Default to Polygon
      lastRequestId: 0
    };

    // Provider identification flags
    this.isMetaMask = false;
    this.isIntersend = true;
    this.isSafe = true;
    this.isPortability = true;

    // Allowed domains for security
    this.allowedDomains = ['app.intersend.io', 'intersend.io', 'localhost']

    // Event handlers registry
    this._eventHandlers = {
      accountsChanged: new Set(),
      chainChanged: new Set(),
      connect: new Set(),
      disconnect: new Set()
    };

    // Initialize only if running in iframe
    if (this._isIframe()) {
      this._initialize();
    }
  }

  /**
   * Check if current context is within an iframe
   */
  _isIframe() {
    return typeof window !== 'undefined' && window !== window.parent;
  }

  /**
   * Validate message origin
   */
  _isValidOrigin(origin) {
    try {
      const url = new URL(origin);
      return this.allowedDomains.some(domain => url.hostname === domain);
    } catch {
      return false;
    }
  }

  /**
   * Generate unique request ID
   */
  _generateRequestId() {
    this._state.lastRequestId++;
    return `intersend_${Date.now()}_${this._state.lastRequestId}`;
  }

  /**
   * Initialize provider and set up message listeners
   */
  _initialize() {
    // Request initial wallet info
    this._requestWalletInfo();

    // Setup message handler
    window.addEventListener('message', this._handleMessage.bind(this));
  }

  /**
   * Handle incoming messages from parent frame
   */
  _handleMessage(event) {
    // Validate message origin
    if (!this._isValidOrigin(event.origin)) {
      console.warn('Message received from unauthorized origin:', event.origin);
      return;
    }

    const { type, payload, id, error } = event.data || {};

    switch (type) {
      case 'WALLET_INFO':
        this._handleWalletInfo(payload);
        break;
      case 'CHAIN_CHANGED':
        this._handleChainChanged(payload);
        break;
      case 'ACCOUNTS_CHANGED':
        this._handleAccountsChanged(payload);
        break;
      case 'DISCONNECT':
        this._handleDisconnect();
        break;
      // Add other message type handlers as needed
    }
  }

  /**
   * Handle wallet info updates
   */
  _handleWalletInfo(payload) {
    if (!payload?.address) return;

    const prevChainId = this._state.chainId;
    const prevAccounts = this._state.accounts;

    this._state.accounts = [payload.address];
    this._state.isConnected = true;
    this._state.chainId = payload.chainId || this._state.chainId;

    // Emit relevant events
    if (prevChainId !== this._state.chainId) {
      this._emit('chainChanged', this._state.chainId);
    }

    if (prevAccounts[0] !== payload.address) {
      this._emit('accountsChanged', this._state.accounts);
    }

    if (!prevAccounts.length) {
      this._emit('connect', { chainId: this._state.chainId });
    }
  }

  /**
   * Request wallet information from parent frame
   */
  _requestWalletInfo() {
    window.parent.postMessage({
      type: 'REQUEST_WALLET_INFO',
      id: this._generateRequestId()
    }, '*');
  }

   /**
   * Handle provider requests
   */
   async request({ method, params }) {
    if (!this._isIframe()) {
      throw new Error('IntersendProvider is only available within iframes');
    }

    console.debug('Provider request:', method, params);

    switch (method) {
      case 'eth_requestAccounts':
        return this._handleAccountsRequest();

      case 'eth_accounts':
        return Promise.resolve(this._state.accounts);

      case 'eth_chainId':
        return Promise.resolve(this._state.chainId);

      case 'wallet_switchEthereumChain':
        return this._handleChainSwitch(params);

      case 'personal_sign':
      case 'eth_sign':
      case 'eth_signTypedData':
      case 'eth_signTypedData_v4':
        return this._handleSigningRequest(method, params);

      default:
        return this._handleRpcRequest(method, params);
    }
  }

  /**
   * Handle account connection request
   */
  async _handleAccountsRequest() {
    if (this._state.accounts.length > 0) {
      return this._state.accounts;
    }

    return new Promise((resolve, reject) => {
      const requestId = this._generateRequestId();
      const timeout = setTimeout(() => {
        this._removeMessageHandler(requestId);
        reject(new Error('Account request timeout'));
      }, 30000);

      this._setupMessageHandler(requestId, (response) => {
        clearTimeout(timeout);
        if (response.error) {
          reject(new Error(response.error));
        } else if (response.payload?.address) {
          this._handleWalletInfo(response.payload);
          resolve(this._state.accounts);
        }
      });

      window.parent.postMessage({
        type: 'REQUEST_WALLET_INFO',
        id: requestId
      }, '*');
    });
  }

  /**
   * Handle chain switching request
   */
  async _handleChainSwitch(params) {
    return new Promise((resolve, reject) => {
      const requestId = this._generateRequestId();
      const timeout = setTimeout(() => {
        this._removeMessageHandler(requestId);
        reject(new Error('Chain switch timeout'));
      }, 30000);

      this._setupMessageHandler(requestId, (response) => {
        clearTimeout(timeout);
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(null);
        }
      });

      window.parent.postMessage({
        type: 'SWITCH_CHAIN',
        payload: { chainId: params[0].chainId },
        id: requestId
      }, '*');
    });
  }

  /**
   * Handle signing requests
   */
  async _handleSigningRequest(method, params) {
    return new Promise((resolve, reject) => {
      const requestId = this._generateRequestId();
      const timeout = setTimeout(() => {
        this._removeMessageHandler(requestId);
        reject(new Error('Signing request timeout'));
      }, 300000); // 5 minutes timeout for signing

      this._setupMessageHandler(requestId, (response) => {
        clearTimeout(timeout);
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response.payload.signature);
        }
      });

      window.parent.postMessage({
        type: 'SIGNATURE_REQUEST',
        payload: {
          method,
          params,
          address: this._state.accounts[0]
        },
        id: requestId
      }, '*');
    });
  }

  /**
   * Handle general RPC requests
   */
  async _handleRpcRequest(method, params) {
    return new Promise((resolve, reject) => {
      const requestId = this._generateRequestId();
      const timeout = setTimeout(() => {
        this._removeMessageHandler(requestId);
        reject(new Error('RPC request timeout'));
      }, 30000);

      this._setupMessageHandler(requestId, (response) => {
        clearTimeout(timeout);
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response.payload);
        }
      });

      window.parent.postMessage({
        type: 'RPC_REQUEST',
        payload: {
          method,
          params,
          address: this._state.accounts[0]
        },
        id: requestId
      }, '*');
    });
  }

  /**
   * Set up message handler for a specific request
   */
  _setupMessageHandler(requestId, callback) {
    const handler = (event) => {
      if (!this._isValidOrigin(event.origin)) return;
      
      const { id, type, payload, error } = event.data || {};
      if (id === requestId) {
        callback({ type, payload, error });
        this._removeMessageHandler(requestId);
      }
    };

    window.addEventListener('message', handler);
    this._messageHandlers = this._messageHandlers || new Map();
    this._messageHandlers.set(requestId, handler);
  }

  /**
   * Remove message handler
   */
  _removeMessageHandler(requestId) {
    if (this._messageHandlers?.has(requestId)) {
      window.removeEventListener('message', this._messageHandlers.get(requestId));
      this._messageHandlers.delete(requestId);
    }
  }

  /**
   * Event subscription methods
   */
  on(event, handler) {
    if (this._eventHandlers[event]) {
      this._eventHandlers[event].add(handler);
    }
  }

  removeListener(event, handler) {
    if (this._eventHandlers[event]) {
      this._eventHandlers[event].delete(handler);
    }
  }

  _emit(event, data) {
    if (this._eventHandlers[event]) {
      this._eventHandlers[event].forEach(handler => handler(data));
    }
  }
}

/**
 * EIP-6963 provider info
 */
const PROVIDER_INFO = {
  uuid: 'intersend-provider-v1',
  name: 'Intersend',
  icon: 'data:image/svg+xml;base64,...', // Add your base64 encoded icon
  rdns: 'com.intersend'
};

/**
 * Announce provider according to EIP-6963
 */
function announceProvider() {
  // Only announce if in iframe
  if (typeof window === 'undefined' || window === window.parent) {
    return;
  }

  const announcement = {
    provider,
    info: PROVIDER_INFO
  };

  // Announce immediately
  window.dispatchEvent(
    new CustomEvent('eip6963:announceProvider', {
      detail: announcement
    })
  );

  // Listen for future requests
  window.addEventListener('eip6963:requestProvider', () => {
    window.dispatchEvent(
      new CustomEvent('eip6963:announceProvider', {
        detail: announcement
      })
    );
  });
}

// Create provider instance
const provider = new IntersendProvider();

// Inject provider and announce
if (typeof window !== 'undefined') {
  // Only inject if in iframe
  if (window !== window.parent) {
    Object.defineProperty(window, 'ethereum', {
      value: provider,
      writable: true,
      configurable: true,
      enumerable: true
    });

    announceProvider();
  }
}

export { provider, announceProvider };