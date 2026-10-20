class OBSClient {
    constructor() {
        this.obs = null;
        this.connected = false;
    }

    async connect() {
        try {
            this.obs = new OBSWebSocket();

            await this.obs.connect(`ws://${IP_ADDRESS}:${PORT}`, PASSWORD);
            this.connected = true;

            console.log('[OBS] Connected');
        } catch (err) {
            console.error('[OBS] Connection failed', err);
        }
    }

    async updateText(sourceName, text) {
        if (!this.connected) return;

        try {
            await this.obs.call('SetInputSettings', {
                inputName: sourceName,
                inputSettings: {
                    text: String(text)
                }
            });
        } catch (err) {
            console.error('[OBS] Update failed', err);
        }
    }

    async updateScore(score1, score2, sets1, sets2) {
        await Promise.all([
            this.updateText('score1', score1),
            this.updateText('score2', score2),
            this.updateText('sets1', sets1),
            this.updateText('sets2', sets2)
        ]);
    }

    async updateTeams(homeName, awayName) {
        await Promise.all([
            this.updateText('team1', homeName),
            this.updateText('team2', awayName)
        ]);
    }
}

window.obsClient = new OBSClient();