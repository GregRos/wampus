import {yamprint} from "yamprint";
import {Themes} from "yamprint-ansi-color";

export const yp = yamprint.extend({
    formatter : Themes.regular,
    propertyFilter(info) {

        return !info.name.startsWith("_") && info.name !== "source" && (info.descriptor.enumerable || info.owner instanceof Error)
    },

});

