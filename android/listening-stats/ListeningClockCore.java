package com.guichaguri.trackplayer.listening;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** No Android dependencies. All methods are confined to the player looper. */
public final class ListeningClockCore {
    public interface Clock { long elapsed(); long epoch(); }
    public interface Sink { void save(List<Delta> deltas) throws Exception; }
    public static final class Identity {
        public final String key, id, source, name, singer, picUrl;
        public Identity(String key, String id, String source, String name, String singer, String picUrl) {
            this.key=key; this.id=id; this.source=source; this.name=name; this.singer=singer; this.picUrl=picUrl;
        }
    }
    public static final class Delta {
        public final Identity identity;
        public long ms, lastPlayedAt;
        public Delta(Identity identity, long ms, long lastPlayedAt) {
            this.identity=identity; this.ms=ms; this.lastPlayedAt=lastPlayedAt;
        }
    }
    private final Clock clock;
    private final Sink sink;
    private final Map<String, Delta> pending = new LinkedHashMap<>();
    private Identity current;
    private boolean playing;
    private long anchor, lastCheckpoint;
    public ListeningClockCore(Clock clock, Sink sink) {
        this.clock=clock; this.sink=sink;
        anchor=lastCheckpoint=clock.elapsed();
    }
    private void accrue() {
        long now=clock.elapsed();
        long ms=Math.max(0, now-anchor);
        anchor=now;
        if (playing && current != null && ms>0) {
            Delta old=pending.get(current.key);
            pending.put(current.key, new Delta(current, ms+(old==null?0:old.ms), clock.epoch()));
        }
    }
    public void update(Identity identity, boolean isPlaying) {
        accrue();
        if (identity != null && (identity.key==null || identity.key.isEmpty())) identity=null;
        boolean changed=playing!=isPlaying || !same(current, identity);
        current=identity;
        playing=isPlaying && identity!=null;
        if(changed) checkpoint();
    }
    private static boolean same(Identity a, Identity b) {
        return a==b || (a!=null && b!=null && a.key.equals(b.key));
    }
    public void tick() {
        if(clock.elapsed()-lastCheckpoint>=10000) checkpoint();
    }
    /** Failure keeps the entire batch; sink must be atomic or enqueue it atomically. */
    public boolean checkpoint() {
        accrue();
        lastCheckpoint=clock.elapsed();
        if(pending.isEmpty()) return true;
        try {
            sink.save(new ArrayList<>(pending.values()));
            pending.clear();
            return true;
        } catch(Exception error) { return false; }
    }
    public void stop() { update(null, false); checkpoint(); }
}
