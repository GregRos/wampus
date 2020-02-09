import base from "./ava.base";
import integration from "./ava.integration";
import unit from "./ava.unit";

export default {
    ...base,
    files: [
        ...unit.files,
        ...integration.files
    ]
};