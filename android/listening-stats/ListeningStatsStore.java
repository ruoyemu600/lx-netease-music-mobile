package com.guichaguri.trackplayer.listening;

import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

/** Process singleton: every DB operation and pending batch lives on one IO worker. */
public final class ListeningStatsStore extends SQLiteOpenHelper {
    private static ListeningStatsStore instance;
    private final ScheduledExecutorService io=Executors.newSingleThreadScheduledExecutor();
    private final Map<String, ListeningClockCore.Delta> pending=new LinkedHashMap<>();
    private final long enabledAt=System.currentTimeMillis();
    private boolean initialized; // IO-worker confined; only true after a successful commit
    private ListeningStatsStore(Context context) {
        super(context.getApplicationContext(), "lx_material_listening_v1.db", null, 1);
        io.execute(() -> { try { flush(); } catch(Exception ignored) {} });
        io.scheduleWithFixedDelay(() -> { try { flush(); } catch(Exception ignored) {} }, 10, 10, TimeUnit.SECONDS);
    }
    public static synchronized ListeningStatsStore get(Context context) {
        if(instance==null) instance=new ListeningStatsStore(context);
        return instance;
    }
    @Override public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE tracks (key TEXT PRIMARY KEY NOT NULL,id TEXT NOT NULL,source TEXT NOT NULL,name TEXT NOT NULL,singer TEXT NOT NULL,picUrl TEXT,listenedMs INTEGER NOT NULL DEFAULT 0,lastPlayedAt INTEGER NOT NULL DEFAULT 0)");
        db.execSQL("CREATE TABLE meta (key TEXT PRIMARY KEY NOT NULL,value INTEGER NOT NULL)");
        db.execSQL("CREATE INDEX tracks_listening_rank ON tracks(listenedMs DESC,key ASC)");
    }
    @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        throw new IllegalStateException("Unsupported listening schema upgrade");
    }
    public void enqueue(List<ListeningClockCore.Delta> deltas) {
        io.execute(() -> {
            for(ListeningClockCore.Delta d:deltas) {
                ListeningClockCore.Delta old=pending.get(d.identity.key);
                pending.put(d.identity.key,new ListeningClockCore.Delta(d.identity,d.ms+(old==null?0:old.ms),Math.max(d.lastPlayedAt,old==null?0:old.lastPlayedAt)));
            }
            try { flush(); } catch(Exception ignored) { /* retained and retried; snapshot reports error */ }
        });
    }
    private void flush() {
        if(initialized && pending.isEmpty()) return;
        SQLiteDatabase db=getWritableDatabase();
        db.beginTransaction();
        try {
            db.execSQL("INSERT OR IGNORE INTO meta(key,value) VALUES('startedAt',?)",new Object[]{enabledAt});
            for(ListeningClockCore.Delta d:pending.values()) {
                ListeningClockCore.Identity t=d.identity;
                db.execSQL("INSERT OR IGNORE INTO tracks(key,id,source,name,singer,picUrl,listenedMs,lastPlayedAt) VALUES(?,?,?,?,?,?,0,0)",new Object[]{t.key,t.id,t.source,t.name,t.singer,t.picUrl});
                db.execSQL("UPDATE tracks SET id=?,source=?,name=?,singer=?,picUrl=?,listenedMs=listenedMs+?,lastPlayedAt=MAX(lastPlayedAt,?) WHERE key=?",new Object[]{t.id,t.source,t.name,t.singer,t.picUrl,d.ms,d.lastPlayedAt,t.key});
            }
            db.setTransactionSuccessful();
        } finally { db.endTransaction(); }
        initialized=true;
        pending.clear();
    }
    private static int limit(double v) { return Double.isNaN(v)?50:(int)Math.max(1,Math.min(100,v)); }
    private static long offset(double v) { return Double.isNaN(v)?0:(long)Math.max(0,Math.min(9007199254740991d,v)); }
    public void snapshot(double requestedLimit,double requestedOffset,Promise promise) {
        final int count=limit(requestedLimit);
        final long start=offset(requestedOffset);
        io.execute(() -> {
            try {
                flush();
                SQLiteDatabase db=getReadableDatabase();
                db.beginTransaction();
                WritableMap result=Arguments.createMap();
                try {
                    result.putInt("schemaVersion",1);
                    try(Cursor c=db.rawQuery("SELECT value FROM meta WHERE key='startedAt'",null)) {
                        if(!c.moveToFirst()) throw new IllegalStateException("Missing listening start date");
                        result.putDouble("startedAt",c.getLong(0));
                    }
                    long trackCount;
                    try(Cursor c=db.rawQuery("SELECT COALESCE(SUM(listenedMs),0),COUNT(*) FROM tracks",null)) {
                        c.moveToFirst(); result.putDouble("totalMs",c.getLong(0)); trackCount=c.getLong(1);
                        result.putDouble("trackCount",trackCount);
                    }
                    WritableArray tracks=Arguments.createArray();
                    try(Cursor c=db.rawQuery("SELECT key,id,source,name,singer,picUrl,listenedMs,lastPlayedAt FROM tracks ORDER BY listenedMs DESC,key ASC LIMIT ? OFFSET ?",new String[]{String.valueOf(count),String.valueOf(start)})) {
                        while(c.moveToNext()) {
                            WritableMap track=Arguments.createMap();
                            String[] keys={"key","id","source","name","singer","picUrl"};
                            for(int i=0;i<keys.length;i++) { if(c.isNull(i)) track.putNull(keys[i]); else track.putString(keys[i],c.getString(i)); }
                            track.putDouble("listenedMs",c.getLong(6)); track.putDouble("lastPlayedAt",c.getLong(7));
                            tracks.pushMap(track);
                        }
                    }
                    result.putArray("tracks",tracks); result.putDouble("offset",start);
                    result.putBoolean("hasMore",start<trackCount && trackCount-start>count);
                    db.setTransactionSuccessful();
                } finally { db.endTransaction(); }
                promise.resolve(result);
            } catch(Exception error) { promise.reject("E_LISTENING_STORAGE","Listening statistics storage failed; pending listening time is retained for retry",error); }
        });
    }
}
