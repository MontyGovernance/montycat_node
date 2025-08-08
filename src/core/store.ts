import { InMemory, InMemoryDistributed } from './inmemory.js';
import { Persistent, PersistentDistributed } from './persistent.js';

/**
 * Keyspace class that provides access to different keyspace implementations.
 * It serves as a factory for creating instances of InMemory and Persistent keyspaces.
 */
class Keyspace {

    static InMemory = InMemory;
    static Persistent = Persistent;
    static InMemoryDistributed = InMemoryDistributed;
    static PersistentDistributed = PersistentDistributed;

}

export default Keyspace;