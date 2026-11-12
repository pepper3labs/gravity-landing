import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recommendedCampaignLevel} from '../src/campaign';
import {GameEconomy} from '../src/economy';
import {CampaignProgress} from '../src/progress';
import {LEVELS} from '../src/levels';

test('new economy unlocks two tutorials but recommends the first without mutating saves',()=>{
 const data=new Map<string,string>();const economy=new GameEconomy({getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,v);}});
 const progress=new CampaignProgress(economy.campaignStorage,{unlocked:id=>economy.unlocked(id),highest:()=>economy.highest()});
 const before=JSON.stringify([...data]);
 assert.equal(economy.highest(),2);assert.equal(recommendedCampaignLevel(progress).order,1);assert.equal(JSON.stringify([...data]),before);
});
test('recommendation skips completed routes, never suggests locked routes and handles all completed',()=>{
 const completed=new Set<string>([LEVELS[0].id]);
 const progress={unlocked:(id:string)=>LEVELS.slice(0,2).some(l=>l.id===id),record:(id:string)=>({completed:completed.has(id)})};
 assert.equal(recommendedCampaignLevel(progress).order,2);
 completed.add(LEVELS[1].id);assert.equal(recommendedCampaignLevel(progress).order,2);
 completed.delete(LEVELS[0].id);assert.equal(recommendedCampaignLevel(progress).order,1);
 assert.equal(recommendedCampaignLevel({unlocked:()=>true,record:()=>({completed:true})}).order,30);
});
