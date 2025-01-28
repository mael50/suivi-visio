import MapManager from './mapManager.js';
import WebSocketManager from './websocketManager.js';
import LocationManager from './locationManager.js';
import CallManager from './callManager.js';

class App {
    /**
     * @class
     * @description Initialise l'application avec les gestionnaires de WebSocket, carte, localisation et appels.
     * Configure les écouteurs d'événements et démarre la mise à jour périodique des positions.
     * @constructor
     * @property {string} username - Nom d'utilisateur de l'utilisateur courant
     * @property {WebSocketManager} websocketManager - Gestionnaire de connexion WebSocket
     * @property {MapManager} mapManager - Gestionnaire de la carte et des marqueurs
     * @property {LocationManager} locationManager - Gestionnaire de la géolocalisation
     * @property {CallManager} callManager - Gestionnaire des appels vidéo
     */
    constructor() {
        this.username = '';
        this.websocketManager = new WebSocketManager('ws://localhost:8080', this.handleWebSocketMessage.bind(this));
        this.mapManager = new MapManager(this.handleCallUser.bind(this));
        this.locationManager = new LocationManager(this.handleLocationUpdate.bind(this));
        this.callManager = new CallManager(this.websocketManager);

        this.setupEventListeners();

        setInterval(() => {
            this.websocketManager.requestPositions();
        }, 3000);
    }


    /**
     * Met en place les écouteurs d'événements pour l'application.
     * Configure le bouton de démarrage pour lancer le suivi et lie la fonction
     * de gestion des appels utilisateur au contexte global.
     * @method
     * @memberof WebRTCApp
     */
    setupEventListeners() {
        document.getElementById('startButton').addEventListener('click', () => this.startTracking());
        window.handleCallUser = this.handleCallUser.bind(this);
    }

    /**
     * Démarre le suivi de localisation de l'utilisateur.
     * Vérifie d'abord si un nom d'utilisateur est saisi.
     * Affiche un loader et masque le formulaire de connexion.
     * Affiche la carte et initialise le suivi de position.
     * Envoie la position initiale via WebSocket.
     * 
     * @returns {void}
     * @throws {Error} Si l'accès à la géolocalisation est refusé
     */
    startTracking() {
        this.username = document.getElementById('username').value.trim();
        if (!this.username) {
            alert('Veuillez entrer un nom');
            return;
        }

        document.getElementById('loader').style.display = 'flex';
        document.getElementById('loginContainer').classList.add('hidden');
        document.getElementById('mapContainer').classList.add('visible');

        if (this.locationManager.startTracking()) {
            navigator.geolocation.getCurrentPosition((position) => {
                const locationData = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    speed: position.coords.speed || 0
                };
                this.websocketManager.sendPosition(this.username, locationData);
            });
        }
    }

    /**
     * Gère les messages WebSocket entrants et les route vers les gestionnaires appropriés.
     * @param {Object} message - L'objet message WebSocket
     * @param {string} message.type - Type de message ('init', 'position', 'call_offer', 'call_answer', 'call_rejected', 'ice_candidate', 'call_ended')
     * @param {Object} [message.users] - Données utilisateurs pour les mises à jour de la carte (requis pour les types 'init' et 'position')
     * @param {Object} [message.offer] - Données d'offre WebRTC (requis pour le type 'call_offer')
     * @param {Object} [message.answer] - Données de réponse WebRTC (requis pour le type 'call_answer')
     * @param {Object} [message.candidate] - Données du candidat ICE (requis pour le type 'ice_candidate')
     * @param {string} [message.from] - Identifiant de l'expéditeur (requis pour les types 'call_offer' et 'ice_candidate')
     * @returns {void}
     */
    handleWebSocketMessage(message) {
        if (message.type === 'init' && !this.mapManager.map) {
            // Si premier message d'initialisation et carte pas encore créée
            const firstUser = message.users.find(user => user.username === this.username);
            if (firstUser) {
                this.mapManager.initialize([firstUser.latitude, firstUser.longitude]);
            }
        }

        switch (message.type) {
            case 'init':
            case 'position':
                this.mapManager.updateMarkers(message.users, this.username);
                if (message.type === 'init') {
                    // Lors de l'initialisation, on centre sur tous les utilisateurs
                    this.mapManager.fitAllMarkers(false);
                }
                break;
            case 'call_offer':
                this.callManager.handleOffer(message.offer, message.from);
                break;
            case 'call_answer':
                this.callManager.handleAnswer(message.answer);
                break;
            case 'call_rejected':
                this.callManager.handleReject();
                break;
            case 'ice_candidate':
                this.callManager.handleIceCandidate(message.candidate, message.from);
                break;
            case 'call_ended':
                this.callManager.endCall();
                break;
        }
    }

    /**
     * Met à jour la position sur la carte et envoie la nouvelle position via WebSocket
     * @param {Object} position - L'objet contenant les informations de position
     * @param {number} position.latitude - La latitude de la position
     * @param {number} position.longitude - La longitude de la position
     * @returns {void}
     */
    handleLocationUpdate(position) {
        const isFirstInit = !this.mapManager.map;

        if (isFirstInit) {
            this.mapManager.initialize([position.latitude, position.longitude]);
            // Centre sur l'utilisateur lors de l'initialisation
            this.mapManager.fitAllMarkers(true, this.username);
        }

        // Envoyer la position ET déclencher une mise à jour globale
        this.websocketManager.sendPosition(this.username, position);
        this.websocketManager.requestPositions();

        document.getElementById('loader').style.display = 'none';
    }

    /**
     * Gère l'initiation d'un appel vers un utilisateur spécifique
     * @param {string} targetUsername - Le nom d'utilisateur de la personne à appeler
     * @throws {Error} Peut lancer une erreur si l'appel ne peut pas être initié
     */
    handleCallUser(targetUsername) {
        this.callManager.startCall(targetUsername);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new App();
});