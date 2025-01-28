class WebSocketManager {
    /**
     * Crée une nouvelle instance du gestionnaire de WebSocket.
     * @constructor
     * @param {string} url - L'URL du serveur WebSocket auquel se connecter.
     * @param {Function} onMessageCallback - Fonction de rappel appelée lorsqu'un message est reçu.
     */
    constructor(url, onMessageCallback) {
        this.socket = new WebSocket(url);
        this.onMessageCallback = onMessageCallback;
        this.setupEventListeners();
    }

    /**
     * Configure les écouteurs d'événements pour la connexion WebSocket.
     * Gère les événements de connexion, de réception de messages, d'erreurs et de fermeture.
     * @method setupEventListeners
     * @instance
     * @memberof WebsocketManager
     * @description Met en place quatre gestionnaires d'événements :
     * - onopen : Déclenché lors de l'établissement de la connexion
     * - onmessage : Gère la réception des messages, avec support des données Blob
     * - onerror : Capture et log les erreurs de connexion
     * - onclose : Déclenché lors de la fermeture de la connexion
     * @throws {Error} Peut lever une exception lors du parsing des messages JSON
     */
    setupEventListeners() {
        this.socket.onopen = () => {
            console.log('Connecté au serveur WebSocket');
        };

        this.socket.onmessage = async (event) => {
            try {
                const text = event.data instanceof Blob ? await event.data.text() : event.data;
                const message = JSON.parse(text);
                this.onMessageCallback(message);
            } catch (error) {
                console.error('Erreur lors du traitement du message:', error);
            }
        };

        this.socket.onerror = (error) => {
            console.error('Erreur WebSocket:', error);
        };

        this.socket.onclose = () => {
            console.log('Connexion WebSocket fermée');
        };
    }

    /**
     * Envoie des données via la connexion WebSocket si elle est ouverte
     * @param {*} data - Les données à envoyer via WebSocket. Seront converties en JSON
     * @throws {Error} Si la connexion WebSocket n'est pas ouverte
     * @returns {void}
     */
    send(data) {
        if (this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(data));
        }
    }

    /**
     * Envoie la position d'un utilisateur via WebSocket.
     * @param {string} username - Le nom d'utilisateur
     * @param {Object} position - L'objet contenant les coordonnées de la position
     * @param {number} position.x - La coordonnée X de la position
     * @param {number} position.y - La coordonnée Y de la position
     */
    sendPosition(username, position) {
        this.send({
            username,
            ...position
        });
    }

    /**
     * Envoie une requête au serveur pour obtenir les positions des participants.
     * Cette méthode émet un message WebSocket de type 'request_positions'.
     */
    requestPositions() {
        this.send({ type: 'request_positions' });
    }
}

export default WebSocketManager; 