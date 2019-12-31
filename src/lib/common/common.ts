/**
 * Function that intializes objects of type T.
 */
export type NewObjectInitializer<T> = (freshClone: T) => void;