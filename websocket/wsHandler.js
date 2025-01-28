const WebSocket = require('ws');
const UserModel = require('../models/userModel');

/**
 * Initialise et configure une connexion WebSocket pour gérer les communications en temps réel.
 * 
 * @param {WebSocket.Server} wss - L'instance du serveur WebSocket à initialiser
 * 
 * @description
 * Cette fonction configure les gestionnaires d'événements pour:
 * - La connexion initiale d'un client
 * - L'envoi de la liste des utilisateurs
 * - La diffusion des positions des utilisateurs
 * - Le traitement des différents types de messages:
 *   - request_positions: Demande de positions
 *   - call_offer: Offre d'appel
 *   - call_answer: Réponse à un appel
 *   - call_rejected: Rejet d'appel
 *   - ice_candidate: Candidat ICE pour WebRTC
 *   - call_ended: Fin d'appel
 *   - position: Mise à jour de position
 * - La gestion des déconnexions
 * 
 * @throws {Error} Peut lancer une erreur lors du traitement des messages
 */
function initializeWebSocket(wss) {
    wss.on('connection', (ws) => {
        // Envoyer la liste initiale des utilisateurs
        ws.send(JSON.stringify({
            type: 'init',
            users: UserModel.getAllUsers()
        }));

        // Diffuser les positions dès qu'un client se connecte
        broadcastPositions(wss);

        // Gérer les messages reçus
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);

                // Gérer les différents types de messages
                switch (data.type) {
                    case 'request_positions':
                        handlePositionRequest(ws);
                        break;
                    case 'call_offer':
                        handleCallOffer(wss, ws, data);
                        break;
                    case 'call_answer':
                        handleCallAnswer(wss, data);
                        break;
                    case 'call_rejected':
                        handleCallRejected(wss, data);
                        break;
                    case 'ice_candidate':
                        handleIceCandidate(wss, data);
                        break;
                    case 'call_ended':
                        handleCallEnded(wss, data);
                        break;
                    case 'position':
                        handlePositionUpdate(ws, data, wss);
                        break;
                    default:
                        handlePositionUpdate(ws, data);
                        break;
                }
            } catch (error) {
                console.error('Erreur lors du traitement du message:', error);
            }
        });

        // Gérer la déconnexion
        ws.on('close', () => {
            if (ws.username) {
                UserModel.deleteUser(ws.username);
                broadcastPositions(wss);
            }
        });
    });
}

/**
 * Gère les requêtes de position des utilisateurs
 * @param {WebSocket} ws - L'instance WebSocket du client demandeur
 * @description Envoie la position de tous les utilisateurs au client demandeur et diffuse ensuite 
 * les positions à tous les clients connectés via la fonction broadcastPositions si wss est disponible
 * @throws {Error} Si l'envoi du message WebSocket échoue
 */
function handlePositionRequest(ws) {
    ws.send(JSON.stringify({
        type: 'position',
        users: UserModel.getAllUsers()
    }));

    if (wss) {
        broadcastPositions(wss);
    }
}

/**
 * Gère la mise à jour de la position d'un utilisateur via WebSocket
 * @param {WebSocket} ws - La connexion WebSocket de l'utilisateur
 * @param {Object} data - Les données de position reçues
 * @param {string} data.username - Nom d'utilisateur
 * @param {number} [data.latitude] - Latitude de l'utilisateur
 * @param {number} [data.longitude] - Longitude de l'utilisateur
 * @param {Object} [data.position] - Position alternative de l'utilisateur
 * @param {number} [data.position.y] - Coordonnée Y (latitude) alternative
 * @param {number} [data.position.x] - Coordonnée X (longitude) alternative
 * @param {number} [data.speed=0] - Vitesse de l'utilisateur
 * @param {WebSocket.Server} wss - Le serveur WebSocket pour le broadcast
 * @returns {void}
 * @throws {Error} Si le nom d'utilisateur est manquant
 */
function handlePositionUpdate(ws, data, wss) {
    if (!data.username) {
        console.error('Nom d\'utilisateur manquant:', data);
        return;
    }

    ws.username = data.username;

    // Gérer les données de position
    const userData = {
        username: data.username,
        latitude: data.latitude !== undefined ? data.latitude : (data.position ? data.position.y : 0),
        longitude: data.longitude !== undefined ? data.longitude : (data.position ? data.position.x : 0),
        speed: data.speed || 0
    };

    // Mettre à jour l'utilisateur
    UserModel.updateUser(userData.username, {
        latitude: userData.latitude,
        longitude: userData.longitude,
        speed: userData.speed
    });

    // Broadcast immédiat à tous les clients
    broadcastPositions(wss);
}

/**
 * Gère l'offre d'appel WebRTC entre deux clients.
 * @param {WebSocketServer} wss - Le serveur WebSocket
 * @param {WebSocket} ws - La connexion WebSocket du client appelant
 * @param {Object} data - Les données de l'offre
 * @param {string} data.target - Le nom d'utilisateur du client cible
 * @param {RTCSessionDescriptionInit} data.offer - L'offre WebRTC
 * @returns {void}
 */
function handleCallOffer(wss, ws, data) {
    const targetClient = findClientByUsername(wss, data.target);
    if (targetClient) {
        targetClient.send(JSON.stringify({
            type: 'call_offer',
            offer: data.offer,
            from: ws.username
        }));
    }
}

/**
 * Gère la réponse à un appel vidéo en transmettant la réponse au client ciblé
 * @param {WebSocketServer} wss - Le serveur WebSocket
 * @param {Object} data - Les données de la réponse
 * @param {string} data.target - Le nom d'utilisateur du client cible
 * @param {RTCSessionDescription} data.answer - La réponse SDP pour l'établissement de la connexion WebRTC
 * @returns {void}
 */
function handleCallAnswer(wss, data) {
    const targetClient = findClientByUsername(wss, data.target);
    if (targetClient) {
        targetClient.send(JSON.stringify({
            type: 'call_answer',
            answer: data.answer
        }));
    }
}

/**
 * Gère le rejet d'un appel en envoyant un message au client ciblé
 * @param {WebSocket.Server} wss - Le serveur WebSocket
 * @param {Object} data - Les données de l'appel rejeté
 * @param {string} data.target - Le nom d'utilisateur du client ciblé
 * @returns {void}
 */
function handleCallRejected(wss, data) {
    const targetClient = findClientByUsername(wss, data.target);
    if (targetClient) {
        targetClient.send(JSON.stringify({
            type: 'call_rejected'
        }));
    }
}

/**
 * Gère les candidats ICE pour la connexion WebRTC entre pairs.
 * @param {WebSocket.Server} wss - Le serveur WebSocket.
 * @param {Object} data - Les données du candidat ICE.
 * @param {string} data.target - Le nom d'utilisateur du destinataire.
 * @param {RTCIceCandidate} data.candidate - Le candidat ICE à transmettre.
 * @param {string} data.username - Le nom d'utilisateur de l'expéditeur.
 */
function handleIceCandidate(wss, data) {
    const targetClient = findClientByUsername(wss, data.target);
    if (targetClient) {
        targetClient.send(JSON.stringify({
            type: 'ice_candidate',
            candidate: data.candidate,
            from: data.username
        }));
    }
}

/**
 * Gère la fin d'un appel en envoyant un message au client cible
 * @param {WebSocketServer} wss - Le serveur WebSocket
 * @param {Object} data - Les données de l'appel
 * @param {string} data.target - Le nom d'utilisateur du client cible
 * @returns {void}
 */
function handleCallEnded(wss, data) {
    const targetClient = findClientByUsername(wss, data.target);
    if (targetClient) {
        targetClient.send(JSON.stringify({
            type: 'call_ended'
        }));
    }
}

/**
 * Recherche un client WebSocket par son nom d'utilisateur dans l'instance WebSocket Server.
 * @param {WebSocket.Server} wss - L'instance du serveur WebSocket.
 * @param {string} username - Le nom d'utilisateur à rechercher.
 * @returns {WebSocket|null} Le client WebSocket correspondant au nom d'utilisateur ou null si non trouvé.
 */
function findClientByUsername(wss, username) {
    let targetClient = null;
    wss.clients.forEach((client) => {
        if (client.username === username) {
            targetClient = client;
        }
    });
    return targetClient;
}

/**
 * Diffuse les positions de tous les utilisateurs à tous les clients connectés via WebSocket.
 * @param {WebSocket.Server} wss - Le serveur WebSocket utilisé pour la diffusion.
 * @description Cette fonction récupère les positions de tous les utilisateurs via UserModel,
 * crée un message JSON contenant ces positions et l'envoie à tous les clients
 * dont la connexion WebSocket est ouverte.
 */
function broadcastPositions(wss) {
    const message = JSON.stringify({
        type: 'position',
        users: UserModel.getAllUsers()
    });

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

module.exports = { initializeWebSocket };