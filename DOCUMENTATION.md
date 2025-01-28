# Documentation Technique Détaillée

Application de Suivi en Temps Réel avec WebRTC

## Vue d'ensemble

### Description

Application web permettant le suivi géographique des utilisateurs en temps réel avec fonctionnalités d'appels vidéo peer-to-peer.

### Fonctionnalités principales

- Suivi géographique en temps réel
- Appels vidéo WebRTC
- Communication WebSocket
- Interface utilisateur responsive
- Gestion des utilisateurs
- Cartographie interactive

### Technologies utilisées

- **Backend**: Node.js, Express.js, WebSocket (ws)
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **API**: WebRTC, Geolocation API, WebSocket API
- **Cartographie**: Leaflet
- **Base de données**: In-memory (Map)

## Architecture

### Architecture générale

```mermaid
graph TB
    subgraph Backend
    S[Server.js] --> WS[WebSocket Handler]
    S --> R[REST API Routes]
    WS --> UM[User Model]
    R --> UM
    end

    subgraph Frontend
    C[Client Browser] --> WSM[WebSocket Manager]
    C --> LM[Location Manager]
    C --> MM[Map Manager]
    C --> CM[Call Manager]
    
    WSM --> APP[App.js]
    LM --> APP
    MM --> APP
    CM --> APP
    end

    WSM <--> WS
    R <--> C
    
    classDef primary fill:#DBE7C9,stroke:#294B2A,stroke-width:2px;
    classDef secondary fill:#f1f1f1,stroke:#475569,stroke-width:2px;

    class S,WS,R,UM primary;
    class C,WSM,LM,MM,CM,APP secondary;
```

### Flux de données

- Le client se connecte et s'authentifie
- Le serveur WebSocket initie une connexion
- La géolocalisation démarre côté client
- Les positions sont diffusées via WebSocket
- Les appels vidéo sont établis en P2P via WebRTC


## Composants Backend

### User Model

- **Description**: Gestion des utilisateurs et de leurs positions.

***Méthodes***

```javascript
static getAllUsers()
static getUser(username)
static updateUser(username, data)
static deleteUser(username)
```

### WebSocket Handler

- **Description**: Gère les connexions WebSocket et les messages en temps réel.

***Types de messages***

- **init** : Initialisation de la connexion
- **position** : Mise à jour de la position
- **call_offer** : Offre d'appel WebRTC
- **call_answer** : Réponse à une offre d'appel
- **ice_candidate** : Candidat ICE pour connexion WebRTC
- **call_ended** : Fin d'appel


### REST API Routes

- **Description**: Interface REST pour la gestion des utilisateurs.

***Endpoints***

- **GET /api/users**
- **GET /api/users/:username**
- **PUT /api/users/:username**
- **DELETE /api/users/:username**

## Composants Frontend

```mermaid
graph TD
    subgraph Frontend Components
        APP[App.js] --> WSM[WebSocketManager]
        APP --> LM[LocationManager]
        APP --> MM[MapManager]
        APP --> CM[CallManager]
        
        MM --> Map[Leaflet Map]
        CM --> RTCConn[RTCPeerConnection]
        LM --> Geo[Geolocation API]
        
        WSM --> Events[Event Bus]
        Events --> MM
        Events --> CM
        Events --> LM
    end
    
    classDef manager fill:#c6dcff,stroke:#3b82f6,stroke-width:2px;
    classDef api fill:#ddd6fe,stroke:#7c3aed,stroke-width:2px;
    
    class WSM,LM,MM,CM manager;
    class Map,RTCConn,Geo api;
```

### App.js

- **Description**: Point d'entrée de l'application frontend.

### Location Manager

- **Description**: Gestion de la géolocalisation côté client.

***Fonctionnalités***

- Suivi en temps réel de la position
- Gestion des erreurs de géolocalisation
- Calcul de la vitesse

### Map Manager

- **Description**: Gestion de la carte interactive Leaflet.

***Fonctionnalités***

- Affichage des utilisateurs sur la carte
- Mise à jour en temps réel des positions
- Popups d'informations
- Zoom et centrage automatique

### Call Manager

- **Description**: Gestion des appels vidéo WebRTC.

***États d'appel***

- **Initial**
- **Offre envoyée**
- **Offre reçue**
- **Connexion établie**
- **Appel en cours**
- **Appel terminé**

```mermaid
sequenceDiagram
    participant A as Appelant
    participant WS as WebSocket Server
    participant B as Appelé

    A->>WS: call_offer (SDP)
    WS->>B: call_offer (SDP)
    B->>WS: call_answer (SDP)
    WS->>A: call_answer (SDP)
    
    loop ICE Negotiation
        A->>WS: ice_candidate
        WS->>B: ice_candidate
        B->>WS: ice_candidate
        WS->>A: ice_candidate
    end
    
    Note over A,B: Connexion P2P établie
```

