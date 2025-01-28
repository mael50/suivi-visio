class MapManager {
    /**
     * Crée une instance de gestionnaire de carte avec les configurations des marqueurs utilisateurs.
     * @constructor
     * @param {Function} onCallUser - Fonction de callback appelée lors d'un appel utilisateur.
     * @property {L.Map} map - Instance de la carte Leaflet.
     * @property {Object} userMarkers - Collection des marqueurs des utilisateurs sur la carte.
     * @property {L.DivIcon} currentUserIcon - Icône personnalisée pour l'utilisateur actuel (vert).
     * @property {L.DivIcon} otherUserIcon - Icône personnalisée pour les autres utilisateurs (bleu).
     */
    constructor(onCallUser) {
        this.map = null;
        this.userMarkers = {};
        this.onCallUser = onCallUser;
        this.updateLegend = this.updateLegend.bind(this);

        this.currentUserIcon = L.divIcon({
            className: 'custom-marker',
            html: `<div class="pulse-dot" style="background-color: #4CAF50;"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
            popupAnchor: [0, -10]
        });

        this.otherUserIcon = L.divIcon({
            className: 'custom-marker',
            html: `<div class="pulse-dot" style="background-color: #2196F3;"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
            popupAnchor: [0, -10]
        });
    }

    /**
     * Initialise la carte Leaflet avec une vue par défaut sur Paris.
     * @param {Array<number>} position - Coordonnées [latitude, longitude] du centre initial de la carte. Par défaut : Paris [48.8534, 2.3488]
     * @returns {void}
     * @throws {Error} Si l'élément avec l'ID 'map' n'existe pas dans le DOM
     */
    initialize(position = [48.8534, 2.3488]) {
        this.map = L.map('map').setView(position, 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
        }).addTo(this.map);
    }

    /**
     * Ajuste la vue de la carte pour afficher soit tous les marqueurs, soit se centrer sur l'utilisateur spécifié
     * @param {boolean} [focusOnUser=false] - Si true, centre la carte sur l'utilisateur spécifié
     * @param {string|null} [currentUsername=null] - Nom d'utilisateur sur lequel centrer la carte si focusOnUser est true
     * @returns {void}
     * @description
     * Si focusOnUser est false ou si aucun utilisateur n'est spécifié :
     * - Ajuste la vue pour inclure tous les marqueurs avec un padding
     * 
     * Si focusOnUser est true et qu'un utilisateur est spécifié :
     * - Centre la carte sur la position de l'utilisateur avec un zoom fixe de 15
     * 
     * Ne fait rien si aucun marqueur n'existe sur la carte
     */
    fitAllMarkers(focusOnUser = false, currentUsername = null) {
        if (Object.values(this.userMarkers).length === 0) return;

        if (focusOnUser && currentUsername && this.userMarkers[currentUsername]) {
            // Centre sur l'utilisateur courant avec un zoom fixe
            const userMarker = this.userMarkers[currentUsername];
            const userLatLng = userMarker.getLatLng();
            this.map.setView(userLatLng, 15);
        } else {
            // Ajuste la vue pour montrer tous les marqueurs
            const group = L.featureGroup(Object.values(this.userMarkers));
            this.map.fitBounds(group.getBounds(), {
                padding: [50, 50],
                maxZoom: 15
            });
        }
    }

    /**
     * Met à jour la légende des utilisateurs connectés.
     * @param {Array<Object>} users - Tableau d'objets utilisateur contenant les informations de localisation
     * @param {string} currentUsername - Nom d'utilisateur de l'utilisateur actuel
     * @returns {void}
     * @description
     * Met à jour la liste des utilisateurs connectés et met en surbrillance l'utilisateur actuel.
     * Lorsqu'un nom d'utilisateur est cliqué, la carte se centre sur le marqueur de l'utilisateur.
     */
    updateLegend(users, currentUsername) {
        const userList = document.getElementById('userList');
        const userCount = document.getElementById('userCount');

        userList.innerHTML = '';
        userCount.textContent = users.length;

        users.forEach(user => {
            const li = document.createElement('li');
            li.className = user.username === currentUsername ? 'current-user' : '';

            // Conteneur pour les infos utilisateur
            const userInfo = document.createElement('div');
            userInfo.className = 'user-info';
            userInfo.textContent = user.username;
            li.appendChild(userInfo);

            // Icône de téléphone à droite
            if (user.username !== currentUsername) {
                const callIcon = document.createElement('div');
                callIcon.className = 'call-icon';
                callIcon.innerHTML = '📞';
                callIcon.title = `Appeler ${user.username}`;
                callIcon.onclick = (e) => {
                    e.stopPropagation();
                    if (this.onCallUser) {
                        this.onCallUser(user.username);
                    }
                };
                li.appendChild(callIcon);
            }

            li.addEventListener('click', () => {
                const marker = this.userMarkers[user.username];
                if (marker) {
                    this.map.setView(marker.getLatLng(), 15);
                    marker.openPopup();
                }
            });

            userList.appendChild(li);
        });
    }

    /**
     * Met à jour les marqueurs sur la carte en fonction des utilisateurs.
     * Préserve l'état des popups lors de la mise à jour.
     * @param {Array<Object>} users - Tableau d'objets utilisateur contenant les informations de localisation
     * @param {string} currentUsername - Nom d'utilisateur de l'utilisateur actuel
     * @returns {void}
     */
    updateMarkers(users, currentUsername) {
        const openPopups = {};
        const currentCenter = this.map.getCenter();
        const currentZoom = this.map.getZoom();

        Object.entries(this.userMarkers).forEach(([username, marker]) => {
            if (marker.isPopupOpen()) {
                openPopups[username] = true;
            }
            this.map.removeLayer(marker);
        });

        this.userMarkers = {};

        users.forEach(userData => {
            const marker = this.addUserMarker(userData, currentUsername);
            if (openPopups[userData.username]) {
                marker.openPopup();
            }
        });

        this.updateLegend(users, currentUsername);

        this.map.setView(currentCenter, currentZoom, {
            animate: false
        });
    }

    /**
     * Ajoute un marqueur utilisateur sur la carte.
     * @param {Object} userData - Les données de l'utilisateur
     * @param {string} userData.username - Le nom d'utilisateur
     * @param {number} userData.latitude - La latitude de la position de l'utilisateur
     * @param {number} userData.longitude - La longitude de la position de l'utilisateur
     * @param {number} userData.speed - La vitesse de l'utilisateur en m/s
     * @param {string} currentUsername - Le nom d'utilisateur actuel
     * @returns {L.Marker} Le marqueur créé
     */
    addUserMarker(userData, currentUsername) {
        const { username, latitude, longitude, speed } = userData;
        const isCurrentUser = username === currentUsername;

        const marker = L.marker([latitude, longitude], {
            icon: isCurrentUser ? this.currentUserIcon : this.otherUserIcon
        });

        let popupContent = `
            <div class="custom-popup">
                <div class="user-name">${username}</div>
                <div class="speed-info">Vitesse: ${speed || 0} m/s</div>
        `;

        if (!isCurrentUser) {
            popupContent += `
                <button class="call-button" onclick="window.handleCallUser('${username}')">
                    Appeler
                </button>
            `;
        }

        popupContent += `</div>`;

        marker.bindPopup(popupContent);
        marker.addTo(this.map);
        this.userMarkers[username] = marker;

        return marker;
    }
}

export default MapManager; 