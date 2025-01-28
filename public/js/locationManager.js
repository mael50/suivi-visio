class LocationManager {
    /**
     * Crée une nouvelle instance du gestionnaire de localisation
     * @param {Function} onLocationUpdate - Fonction de rappel appelée lorsque la position est mise à jour
     * @constructor
     */
    constructor(onLocationUpdate) {
        this.watchId = null;
        this.onLocationUpdate = onLocationUpdate;
    }

    /**
     * Démarre le suivi de la géolocalisation de l'utilisateur.
     * Initialise la position actuelle et met en place un suivi continu.
     * 
     * @method startTracking
     * @returns {boolean} Retourne true si le suivi a démarré avec succès, false si la géolocalisation n'est pas supportée
     * @throws {Error} Peut échouer si l'utilisateur refuse l'accès à la géolocalisation
     * 
     * @requires navigator.geolocation
     * 
     * @example
     * locationManager.startTracking();
     */
    startTracking() {
        if (!navigator.geolocation) {
            console.error('La géolocalisation n\'est pas supportée par ce navigateur');
            return false;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        };

        // Position initiale
        navigator.geolocation.getCurrentPosition(
            this.handleSuccess.bind(this),
            this.handleError.bind(this),
            options
        );

        // Suivi continu de la position
        this.watchId = navigator.geolocation.watchPosition(
            this.handleSuccess.bind(this),
            this.handleError.bind(this),
            options
        );

        return true;
    }

    /**
     * Arrête le suivi de la géolocalisation en temps réel.
     * Efface le watchId actif et arrête la surveillance de la position.
     * @method
     * @returns {void}
     */
    stopTracking() {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
    }

    /**
     * Gère le succès de la récupération de la position géographique.
     * @param {GeolocationPosition} position - L'objet Position contenant les coordonnées géographiques
     * @description Extrait les données de latitude, longitude et vitesse de la position et les transmet via le callback onLocationUpdate
     * @throws {Error} Si le callback onLocationUpdate n'est pas défini
     */
    handleSuccess(position) {
        const locationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            speed: position.coords.speed || 0
        };

        this.onLocationUpdate(locationData);
    }

    /**
     * Gère les erreurs liées à la géolocalisation.
     * Affiche des alertes spécifiques en fonction du type d'erreur rencontré.
     * 
     * @param {GeolocationPositionError} error - L'objet d'erreur de géolocalisation
     * @throws {Error} Affiche une alerte avec le message d'erreur correspondant
     * 
     * Les codes d'erreur possibles sont :
     * - PERMISSION_DENIED : L'utilisateur a refusé la demande de géolocalisation
     * - POSITION_UNAVAILABLE : Impossible d'obtenir la position
     * - TIMEOUT : Le délai d'attente pour obtenir la position est dépassé
     */
    handleError(error) {
        console.error('Erreur de géolocalisation:', error);
        switch (error.code) {
            case error.PERMISSION_DENIED:
                alert('Vous devez autoriser la géolocalisation pour utiliser cette application.');
                break;
            case error.POSITION_UNAVAILABLE:
                alert('Information de localisation indisponible.');
                break;
            case error.TIMEOUT:
                alert('Délai d\'attente de la géolocalisation dépassé.');
                break;
            default:
                alert('Une erreur inconnue est survenue.');
                break;
        }
    }
}

export default LocationManager; 