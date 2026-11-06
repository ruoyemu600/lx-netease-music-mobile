package com.guichaguri.trackplayer.listening;

import android.content.Context;
import android.os.Bundle;
import android.os.Handler;
import android.os.SystemClock;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import com.facebook.react.bridge.Promise;
import com.guichaguri.trackplayer.service.models.Track;

/** Player-looper only. Uses isPlaying, never position, playback speed, or JS timers. */
@UnstableApi
public final class ListeningStatsAdapter {
    public interface CurrentTrack { Track get(); }
    private final Player player;
    private final CurrentTrack currentTrack;
    private final Handler handler;
    private final ListeningStatsStore store;
    private final ListeningClockCore core;
    private boolean closed;
    private final Runnable checkpoint=new Runnable() {
        @Override public void run() {
            if(closed) return;
            sync();
            core.tick();
            handler.postDelayed(this,10000);
        }
    };
    public ListeningStatsAdapter(Context context,Player player,CurrentTrack currentTrack) {
        this.player=player; this.currentTrack=currentTrack;
        handler=new Handler(player.getApplicationLooper());
        store=ListeningStatsStore.get(context);
        core=new ListeningClockCore(new ListeningClockCore.Clock() {
            public long elapsed() { return SystemClock.elapsedRealtime(); }
            public long epoch() { return System.currentTimeMillis(); }
        }, store::enqueue);
        sync();
        handler.postDelayed(checkpoint,10000);
    }
    private static String string(Bundle bundle,String key) {
        Object value=bundle.get(key);
        return value==null?"":String.valueOf(value);
    }
    private ListeningClockCore.Identity identity() {
        Track track=currentTrack.get();
        Bundle b=track==null?null:track.originalItem;
        if(b==null) return null;
        String key=string(b,"listeningKey");
        if(key.isEmpty()) return null;
        String pic=string(b,"listeningPicUrl");
        return new ListeningClockCore.Identity(key,string(b,"listeningId"),string(b,"listeningSource"),string(b,"listeningName"),string(b,"listeningSinger"),pic.isEmpty()?null:pic);
    }
    public void sync() { if(!closed) core.update(identity(),player.isPlaying()); }
    public void snapshot(double limit,double offset,Promise promise) {
        sync();
        core.checkpoint();
        store.snapshot(limit,offset,promise);
    }
    public void close() {
        if(closed) return;
        core.stop();
        closed=true;
        handler.removeCallbacks(checkpoint);
    }
}
