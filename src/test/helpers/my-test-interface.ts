import {default as avaTest, TestInterface} from "ava";

/**
 * We do this because at some point ava added typed contexts.
 */
export const test: TestInterface<{session: any}> = avaTest;