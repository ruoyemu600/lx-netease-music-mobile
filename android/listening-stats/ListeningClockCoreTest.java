package com.guichaguri.trackplayer.listening;
import java.util.*;
public final class ListeningClockCoreTest {
    static final class Clock implements ListeningClockCore.Clock {
        long now, wallShift;
        public long elapsed(){return now;}
        public long epoch(){return 1700000000000L+now+wallShift;}
        void advance(long n){now+=n;}
    }
    static final class Sink implements ListeningClockCore.Sink {
        Map<String,Long> totals=new HashMap<>(); boolean fail; int writes;
        public void save(List<ListeningClockCore.Delta> ds)throws Exception {
            if(fail)throw new Exception("test failure");
            writes++;
            for(ListeningClockCore.Delta d:ds)totals.put(d.identity.key,totals.getOrDefault(d.identity.key,0L)+d.ms);
        }
        long total(String key){return totals.getOrDefault(key,0L);}
    }
    static ListeningClockCore.Identity track(String k){return new ListeningClockCore.Identity(k,k,"source",k,"singer",null);}
    static void eq(long expected,long actual,String label){if(expected!=actual)throw new AssertionError(label+": expected "+expected+", got "+actual);}
    public static void main(String[] args){
        Clock c=new Clock(); Sink s=new Sink(); ListeningClockCore x=new ListeningClockCore(c,s);
        ListeningClockCore.Identity a=track("A"), b=track("B");
        x.update(a,true); c.advance(1000); x.update(a,false); // pause
        c.advance(9000); x.update(a,false); x.checkpoint(); eq(1000,s.total("A"),"pause excludes time");
        x.update(a,true); c.advance(2000); x.update(a,false); // buffering/suppression same isPlaying=false
        c.advance(7000); x.update(a,true); c.advance(500); x.update(a,true); // seek/speed carry no position input
        c.advance(500); x.update(a,true); x.checkpoint(); eq(4000,s.total("A"),"buffer seek speed");
        c.advance(1000); x.update(b,true); c.advance(2000); x.update(a,true); c.advance(3000); x.update(null,true);
        c.advance(20000); x.update(null,false); x.checkpoint(); eq(8000,s.total("A"),"A-B-A");eq(2000,s.total("B"),"B attribution / placeholder excluded");
        x.update(a,true); int writes=s.writes; c.advance(9999); x.tick();eq(writes,s.writes,"before checkpoint");
        c.advance(1);x.tick();eq(writes+1,s.writes,"10s checkpoint");eq(18000,s.total("A"),"10s amount");
        x.update(a,true);x.update(a,true);x.checkpoint();eq(18000,s.total("A"),"duplicate events");
        s.fail=true;c.advance(1000);x.update(b,true);c.advance(2000);x.checkpoint();eq(18000,s.total("A"),"failure retains A");
        s.fail=false;x.checkpoint();eq(19000,s.total("A"),"retry A exactly once");eq(4000,s.total("B"),"retry B exactly once");x.checkpoint();eq(4000,s.total("B"),"retry no double count");
        x.stop();x.stop();c.advance(60000); // process restart never resumes previous monotonic anchor
        ListeningClockCore y=new ListeningClockCore(c,s);y.checkpoint();eq(4000,s.total("B"),"restart no phantom");
        y.update(b,true);c.advance(1000);y.stop();eq(5000,s.total("B"),"new session elapsed only");
        y.update(track(""),true);c.advance(1000);y.stop();eq(0,s.total(""),"empty key");
        y.update(a,true); c.wallShift=-86400000; c.advance(1000); y.checkpoint();
        c.wallShift=86400000; c.advance(1000); y.stop();eq(21000,s.total("A"),"wall clock jumps do not change elapsed");
        System.out.println("PASS: pause/buffer/suppression/seek/speed/A-B-A/placeholder/duplicates/10s/failure-retry/restart/stop/wall-clock-jumps");
    }
}
