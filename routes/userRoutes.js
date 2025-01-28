const express = require('express');
const router = express.Router();
const UserModel = require('../models/userModel');

// Obtenir tous les utilisateurs
router.get('/', (req, res) => {
    const users = UserModel.getAllUsers();
    res.json(users);
});

// Obtenir un utilisateur spécifique
router.get('/:username', (req, res) => {
    const user = UserModel.getUser(req.params.username);
    if (!user) {
        return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    res.json(user);
});

// Mettre à jour la position d'un utilisateur
router.put('/:username/position', express.json(), (req, res) => {
    const { position } = req.body;
    if (!position) {
        return res.status(400).json({ message: 'Position requise' });
    }
    const user = UserModel.updateUser(req.params.username, position);
    res.json(user);
});

// Supprimer un utilisateur
router.delete('/:username', (req, res) => {
    const deleted = UserModel.deleteUser(req.params.username);
    if (!deleted) {
        return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    res.status(204).send();
});

module.exports = router;
