window.RNBO_UI_SKINS = window.RNBO_UI_SKINS || {};

window.RNBO_UI_SKINS.juno = {
    name: "Juno Example",
    theme: "juno",
    description: "Instrument-specific panel preserved from the copied Juno workflow.",
    precisionNumberParamIds: [],
    numberControlOptions: {},
    keyboard: {
        startNote: 36,
        totalNotes: 60
    },
    labelOverrides: {
        FilterMode: "Mode",
        Resonance: "Res",
        FilterOffset: "Cutoff",
        LFORate: "Rate",
        LFOShape: "Shape",
        PitchLFOAmt: "Vib",
        PWLFOAmt: "PWM",
        FilterLFOAmt: "Filter",
        FilterEnvAttack: "A",
        FilterEnvDecay: "D",
        FilterEnvSustain: "S",
        FilterEnvRelease: "R",
        FilterEnvAmt: "Env",
        SawLevel: "Saw",
        PulseLevel: "Pulse",
        SubLevel: "Sub",
        NoiseLevel: "Noise",
        PW: "PW",
        VCAEnvAttack: "A",
        VCAEnvDecay: "D",
        VCAEnvSustain: "S",
        VCAEnvRelease: "R"
    },
    graphicSelectorParamIds: ["LFOShape", "FilterMode"],
    createGroups() {
        return [
            {
                title: "LFO",
                controls: ["LFOShape", "LFORate", "PitchLFOAmt", "PWLFOAmt", "FilterLFOAmt"]
            },
            {
                title: "Osc",
                controls: ["SawLevel", "PulseLevel", "PW", "SubLevel", "NoiseLevel"]
            },
            {
                title: "Filter",
                controls: ["FilterMode", "FilterOffset", "Resonance", "FilterEnvAmt"]
            },
            {
                title: "Filter Env",
                controls: ["FilterEnvAttack", "FilterEnvDecay", "FilterEnvSustain", "FilterEnvRelease"]
            },
            {
                title: "VCA Env",
                controls: ["VCAEnvAttack", "VCAEnvDecay", "VCAEnvSustain", "VCAEnvRelease"]
            }
        ];
    }
};
