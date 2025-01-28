const users = new Map();

/**
 * @class UserModel
 * @description Classe pour gérer les opérations CRUD des utilisateurs
 * @static
 */
class UserModel {
    static getAllUsers() {
        return Array.from(users.values());
    }

    static getUser(username) {
        return users.get(username);
    }

    static updateUser(username, data) {
        const user = {
            username,
            latitude: data.latitude || 0,
            longitude: data.longitude || 0,
            speed: data.speed || 0,
            lastUpdate: new Date()
        };
        users.set(username, user);
        return user;
    }

    static deleteUser(username) {
        return users.delete(username);
    }
}

module.exports = UserModel; 