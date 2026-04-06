window.RNBO_UI_SKINS = window.RNBO_UI_SKINS || {};

window.RNBO_UI_SKINS.chowningfm = {
    name: "Chowning FM",
    theme: "chowningfm",
    description: "Three paired control groups for carrier tuning, modulator tuning, and FM deviation.",
    precisionNumberParamIds: ["CarrierRatio", "ModulatorRatio", "ModulationIndex"],
    hiddenParamIds: ["NoteInput", "Volume"],
    keyboard: {
        startNote: 36,
        totalNotes: 61
    },
    labelOverrides: {
        CarrierRatio: "Ratio",
        ModulatorRatio: "Ratio",
        ModulationIndex: "AMOUNT",
        Volume: "Level"
    },
    outputControlLabel: "Level",
    createGroups() {
        return [
            {
                title: "Carrier",
                accent: "carrier",
                controls: ["CarrierRatio"],
                derivedTags: ["CarrierFreq"]
            },
            {
                title: "Modulator",
                accent: "modulator",
                controls: ["ModulatorRatio"],
                derivedTags: ["ModulatorFreq"]
            },
            {
                title: "Modulation Index",
                accent: "deviation",
                controls: ["ModulationIndex"],
                derivedTags: ["FreqDeviation"]
            }
        ];
    }
};
