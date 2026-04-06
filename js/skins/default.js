window.RNBO_UI_SKINS = window.RNBO_UI_SKINS || {};

window.RNBO_UI_SKINS.default = {
    name: "Default",
    theme: "default",
    description: "Neutral starter skin for any RNBO export.",
    precisionNumberParamIds: [],
    numberControlOptions: {},
    createGroups(parameters, config) {
        const chunkSize = Math.max(1, Number(config.controlGroupSize) || 6);
        const groups = [];

        for (let index = 0; index < parameters.length; index += chunkSize) {
            groups.push({
                title: `Parameters ${Math.floor(index / chunkSize) + 1}`,
                controls: parameters.slice(index, index + chunkSize).map((param) => param.id)
            });
        }

        return groups;
    }
};
