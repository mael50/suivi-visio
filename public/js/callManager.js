/**
 * Manages WebRTC video calls including peer connections, media streams, and UI elements.
 * Handles call initialization, signaling, and cleanup through a WebSocket connection.
 */
class CallManager {
    /**
     * Gestionnaire d'appels WebRTC.
     * @constructor
     * @param {WebSocket} websocketManager - Le gestionnaire de WebSocket utilisé pour la signalisation
     * @property {RTCPeerConnection} peerConnection - Connexion pair-à-pair pour WebRTC
     * @property {MediaStream} localStream - Flux média local (audio/vidéo)
     * @property {MediaStream} remoteStream - Flux média du pair distant
     * @property {WebSocket} websocket - Connexion WebSocket pour la signalisation
     * @property {Object} currentCall - Informations sur l'appel en cours
     * @property {boolean} debug - Active les logs détaillés
     */
    constructor(websocketManager) {
        /** @type {RTCPeerConnection} Peer connection for WebRTC */
        this.peerConnection = null;
        /** @type {MediaStream} Local media stream (audio/video) */
        this.localStream = null;
        /** @type {MediaStream} Remote peer's media stream */
        this.remoteStream = null;
        /** @type {WebSocket} WebSocket connection for signaling */
        this.websocket = websocketManager;
        /** @type {Object} Current call information */
        this.currentCall = null;
        /** @type {boolean} Enable detailed logging */
        this.debug = true;
    }

    /**
     * Log les messages avec un préfixe indiquant la classe.
     * @param {...any} args - Les arguments à logger
     * @private
     */
    log(...args) {
        if (this.debug) {
            console.log('[CallManager]', ...args);
        }
    }

    /**
     * Initialise le flux média local avec l'audio et la vidéo.
     * @returns {Promise<boolean>} Vrai si l'initialisation réussit, faux sinon
     */
    async initialize() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            this.log('Flux local initialisé:', this.localStream.getTracks().map(t => t.kind));
            return true;
        } catch (error) {
            console.error('Erreur d\'accès à la caméra:', error);
            return false;
        }
    }

    /**
     * Initie un appel vers un utilisateur cible.
     * @param {string} targetUsername - Nom d'utilisateur du destinataire de l'appel
     */
    async startCall(targetUsername) {
        if (!this.localStream) {
            const initialized = await this.initialize();
            if (!initialized) return;
        }

        this.peerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        });

        this.setupPeerConnectionHandlers();

        // Add local tracks
        this.localStream.getTracks().forEach(track => {
            this.log('Ajout track local:', track.kind);
            const sender = this.peerConnection.addTrack(track, this.localStream);
            this.log('Sender créé:', sender.track.kind);
        });

        try {
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            this.log('Offre créée:', offer);
            await this.peerConnection.setLocalDescription(offer);
            this.log('Description locale définie');

            this.websocket.send({
                type: 'call_offer',
                target: targetUsername,
                offer: offer
            });

            this.currentCall = {
                username: targetUsername,
                status: 'calling'
            };

            this.showCallUI(true);
        } catch (error) {
            console.error('Erreur lors de la création de l\'offre:', error);
            this.endCall();
        }
    }

    /**
     * Gère les offres d'appel entrantes.
     * @param {RTCSessionDescriptionInit} offer - L'offre WebRTC reçue
     * @param {string} callerUsername - Nom d'utilisateur de l'appelant
     */
    async handleOffer(offer, callerUsername) {
        this.log('Réception offre de:', callerUsername);
        if (!this.localStream) {
            const initialized = await this.initialize();
            if (!initialized) {
                this.rejectCall(callerUsername);
                return;
            }
        }

        this.showCallModal(callerUsername, async (accepted) => {
            if (accepted) {
                try {
                    this.peerConnection = new RTCPeerConnection({
                        iceServers: [
                            { urls: 'stun:stun.l.google.com:19302' },
                            { urls: 'stun:stun1.l.google.com:19302' }
                        ]
                    });

                    this.setupPeerConnectionHandlers();

                    this.localStream.getTracks().forEach(track => {
                        this.log('Ajout track local (récepteur):', track.kind);
                        const sender = this.peerConnection.addTrack(track, this.localStream);
                        this.log('Sender créé (récepteur):', sender.track.kind);
                    });

                    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
                    const answer = await this.peerConnection.createAnswer();
                    await this.peerConnection.setLocalDescription(answer);

                    this.websocket.send({
                        type: 'call_answer',
                        target: callerUsername,
                        answer: answer
                    });

                    this.currentCall = {
                        username: callerUsername,
                        status: 'connected'
                    };

                    this.showCallUI(false);
                } catch (error) {
                    console.error('Erreur lors de la configuration de l\'appel:', error);
                    this.endCall();
                }
            } else {
                this.rejectCall(callerUsername);
            }
        });
    }

    /**
     * Configure les gestionnaires d'événements pour la connexion RTCPeerConnection.
     * @private
     */
    setupPeerConnectionHandlers() {
        this.peerConnection.ontrack = (event) => {
            this.log('Track reçu:', event.track.kind, event.streams);

            if (!this.remoteStream) {
                this.log('Création du remoteStream');
                this.remoteStream = new MediaStream();
            }

            const trackExists = this.remoteStream.getTracks().some(t => t.id === event.track.id);
            if (!trackExists) {
                this.log('Ajout de la track au remoteStream:', event.track.kind);
                this.remoteStream.addTrack(event.track);
                this.updateRemoteVideo();
            }

            event.track.onended = () => this.log('Track terminée:', event.track.kind);
            event.track.onmute = () => this.log('Track muette:', event.track.kind);
            event.track.onunmute = () => this.log('Track démutée:', event.track.kind);
        };

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.currentCall) {
                this.log('Envoi candidat ICE:', event.candidate);
                this.websocket.send({
                    type: 'ice_candidate',
                    target: this.currentCall.username,
                    candidate: event.candidate
                });
            }
        };

        this.peerConnection.onconnectionstatechange = () => {
            this.log('État de la connexion:', this.peerConnection.connectionState);
            if (this.peerConnection.connectionState === 'connected') {
                this.updateRemoteVideo();
            }
        };

        this.peerConnection.oniceconnectionstatechange = () => {
            this.log('État de la connexion ICE:', this.peerConnection.iceConnectionState);
        };

        this.peerConnection.onsignalingstatechange = () => {
            this.log('État de la signalisation:', this.peerConnection.signalingState);
        };

        this.peerConnection.onnegotiationneeded = () => {
            this.log('Négociation nécessaire');
        };
    }

    /**
     * Met à jour l'élément vidéo distant avec le flux distant actuel.
     * @private
     */
    updateRemoteVideo() {
        const remoteVideo = document.getElementById('remoteVideo');
        if (remoteVideo && this.remoteStream) {
            this.log('Mise à jour de la vidéo distante');
            this.log('Tracks dans remoteStream:', this.remoteStream.getTracks().map(t => t.kind));

            remoteVideo.srcObject = this.remoteStream;

            remoteVideo.onloadedmetadata = () => {
                this.log('Métadonnées de la vidéo chargées');
                remoteVideo.play().catch(error => {
                    if (error.name !== 'AbortError') {
                        console.error('Erreur lors de la lecture de la vidéo distante:', error);
                    }
                });
            };
        } else {
            this.log('Impossible de mettre à jour la vidéo distante', {
                videoExists: !!remoteVideo,
                streamExists: !!this.remoteStream
            });
        }
    }

    /**
     * Crée et affiche l'interface utilisateur d'appel avec les éléments vidéo et les contrôles.
     * @param {boolean} isCaller - Indique si l'utilisateur local a initié l'appel
     */
    showCallUI(isCaller) {
        this.hideCallUI();

        const callContainer = document.createElement('div');
        callContainer.id = 'callContainer';
        callContainer.className = 'call-container';

        const videoGrid = document.createElement('div');
        videoGrid.className = 'video-grid';

        const localVideo = document.createElement('video');
        localVideo.id = 'localVideo';
        localVideo.autoplay = true;
        localVideo.playsInline = true;
        localVideo.muted = true;
        localVideo.srcObject = this.localStream;

        const remoteVideo = document.createElement('video');
        remoteVideo.id = 'remoteVideo';
        remoteVideo.autoplay = true;
        remoteVideo.playsInline = true;

        if (this.remoteStream) {
            remoteVideo.srcObject = this.remoteStream;
        }

        const controls = document.createElement('div');
        controls.className = 'call-controls';

        const endCallButton = document.createElement('button');
        endCallButton.textContent = 'Terminer l\'appel';
        endCallButton.onclick = () => this.endCall();

        videoGrid.appendChild(localVideo);
        videoGrid.appendChild(remoteVideo);
        controls.appendChild(endCallButton);
        callContainer.appendChild(videoGrid);
        callContainer.appendChild(controls);

        document.body.appendChild(callContainer);

        localVideo.play().catch(e => console.error('Erreur lecture vidéo locale:', e));
        if (this.remoteStream) {
            remoteVideo.play().catch(e => console.error('Erreur lecture vidéo distante:', e));
        }
    }

    /**
     * Removes the call UI from the DOM.
     * @private
     */
    hideCallUI() {
        const callContainer = document.getElementById('callContainer');
        if (callContainer) {
            callContainer.remove();
        }
    }

    /**
     * Ends the current call and cleans up resources.
     */
    async endCall() {
        this.log('Fin de l\'appel initiée localement');

        if (this.currentCall) {
            this.log('Envoi notification fin d\'appel à:', this.currentCall.username);
            this.websocket.send({
                type: 'call_ended',
                target: this.currentCall.username
            });
        }

        this.cleanupCall();
    }

    /**
     * Rejette un appel entrant
     * @param {string} callerUsername - Nom d'utilisateur de l'appelant
     */
    async rejectCall(callerUsername) {
        this.log('Rejet de l\'appel entrant');
        this.websocket.send({
            type: 'call_rejected',
            target: callerUsername,
            username: this.currentCall?.username // Ajout du nom d'utilisateur qui rejette
        });
    }

    /**
     * Gère le rejet d'un appel
     * @param {string} from - Nom d'utilisateur qui a rejeté l'appel
     */
    handleReject() {
        alert(`L'interlocuteur a rejeté votre appel`);
        this.cleanupCall();
    }

    /**
     * Displays a modal for incoming calls with accept/reject options.
     * @param {string} callerUsername - Username of the caller
     * @param {Function} callback - Callback function called with boolean indicating acceptance
     */
    showCallModal(callerUsername, callback) {
        const overlay = document.createElement('div');
        overlay.className = 'call-modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'call-modal';

        const title = document.createElement('h3');
        title.textContent = `Appel entrant de ${callerUsername}`;

        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'call-modal-buttons';

        const acceptButton = document.createElement('button');
        acceptButton.className = 'call-modal-accept';
        acceptButton.textContent = 'Accepter';
        acceptButton.onclick = () => {
            overlay.remove();
            callback(true);
        };

        const rejectButton = document.createElement('button');
        rejectButton.className = 'call-modal-reject';
        rejectButton.textContent = 'Rejeter';
        rejectButton.onclick = () => {
            overlay.remove();
            callback(false);
        };

        buttonsContainer.appendChild(acceptButton);
        buttonsContainer.appendChild(rejectButton);

        modal.appendChild(title);
        modal.appendChild(buttonsContainer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    }

    /**
     * Gère les réponses d'appel entrantes du pair distant.
     * @param {RTCSessionDescriptionInit} answer - La réponse WebRTC reçue
     */
    async handleAnswer(answer) {
        this.log('Réception réponse');
        try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
            console.error('Erreur lors de la configuration de la réponse:', error);
            this.endCall();
        }
    }

    /**
     * Gère les candidats ICE entrants du pair distant.
     * @param {RTCIceCandidateInit} candidate - Le candidat ICE reçu
     */
    async handleIceCandidate(candidate) {
        this.log('Réception candidat ICE');
        if (!this.peerConnection) {
            this.log('Pas de connexion peer - ignoré');
            return;
        }

        try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            this.log('Candidat ICE ajouté avec succès');
        } catch (error) {
            console.error('Erreur lors de l\'ajout du candidat ICE:', error);
        }
    }

    /**
     * Gère les notifications de fin d'appel du pair distant.
     * @param {string} username - Nom d'utilisateur du pair distant terminant l'appel
     */
    async handleCallEnd(username) {
        this.log('Réception notification fin d\'appel de:', username);

        if (this.currentCall && this.currentCall.username === username) {
            alert(`${username} a mis fin à l'appel`);
            this.cleanupCall();
        }
    }

    /**
     * Nettoie toutes les ressources liées à l'appel et réinitialise l'état.
     * @private
     */
    cleanupCall() {
        this.log('Nettoyage des ressources de l\'appel');

        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        if (this.remoteStream) {
            this.remoteStream.getTracks().forEach(track => track.stop());
            this.remoteStream = null;
        }

        this.hideCallUI();
        this.currentCall = null;
    }

}

export default CallManager;