const db = require("../services/database");

function setPreference(key, value) {
    db.prepare(`
        INSERT INTO preferences (key, value)
        VALUES (?, ?)
        ON CONFLICT(key)
        DO UPDATE SET value = excluded.value
    `).run(key, String(value));

    return {
        success: true,
        key,
        value: String(value),
        message: `Preference "${key}" set to "${value}".`
    };
}

function getPreference(key, defaultValue = null) {
    const result = db.prepare(`
        SELECT value
        FROM preferences
        WHERE key = ?
    `).get(key);

    return result ? result.value : defaultValue;
}

function getAllPreferences() {
    return db.prepare(`SELECT key, value FROM preferences`).all();
}

module.exports = {
    setPreference,
    getPreference,
    getAllPreferences
};