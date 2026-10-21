// Shared DOM helper must be declared before any code uses it.
const $ = (id) => document.getElementById(id);

// Product-name lookup uses Open Food Facts. Public read access needs no API key.
// Search India-tagged products first, then fall back to the global catalogue.
const OFF_API = '/api/off';
const OFF_FIELDS = 'product_name,brands,nutriments,nutriscore_grade,nutrition_grades,code,image_front_url,quantity,categories,countries,countries_tags';
const OFF_HEADERS = { 'Accept': 'application/json' };
const searchForm = $('productSearchForm');
const matchesEl = $('productMatches');
const searchStatus = $('searchStatus');
function setSearchStatus(message, isError=false) { searchStatus.textContent=message; searchStatus.classList.toggle('error-text',isError); searchStatus.hidden=!message; }
function safeText(value,fallback='Not provided') { return value===undefined||value===null||value===''?fallback:String(value); }
function isIndiaProduct(p) { const tags=(p.countries_tags||[]).map(v=>String(v).toLowerCase()); const countries=String(p.countries||'').toLowerCase(); return tags.some(v=>v==='en:india'||v.endsWith(':india'))||/(^|[,; ])india([,; ]|$)/.test(countries); }
function gradeLabel(grade) { const map={a:'A · Excellent',b:'B · Good',c:'C · Moderate',d:'D · Poor',e:'E · Poor'}; return map[String(grade||'').toLowerCase()]||'Not available'; }
function productToNutrients(p) {
 const n=p.nutriments||{};
 const get=(...keys)=>{for(const key of keys){const v=n[key];if(v!==undefined&&v!==null&&v!==''&&Number.isFinite(Number(v)))return Number(v);}return null;};
 const sodiumG=get('sodium_100g'),saltG=get('salt_100g');
 const energyKcal=get('energy-kcal_100g'); const energyKj=get('energy_100g');
 return {sugar:get('sugars_100g'),saturatedFat:get('saturated-fat_100g'),sodium:sodiumG!==null?sodiumG*1000:(saltG!==null?saltG*1000/2.5:null),protein:get('proteins_100g'),fiber:get('fiber_100g'),calories:energyKcal!==null?energyKcal:(energyKj!==null?energyKj/4.184:null),totalFat:get('fat_100g'),serving:null};
}
function showProductMatches(products) {
 matchesEl.innerHTML=''; matchesEl.hidden=false;
 if(!products.length){matchesEl.textContent='No matching products found. Check spelling, try adding/removing the brand, or use the label upload option.';return;}
 products.forEach(product=>{
  const card=document.createElement('article');card.className='product-match';
  if(product.image_front_url){const img=document.createElement('img');img.src=product.image_front_url;img.alt='';img.loading='lazy';img.onerror=()=>img.remove();card.append(img);}
  const details=document.createElement('div');details.className='product-match-details';
  const title=document.createElement('h3');title.textContent=safeText(product.product_name,'Unnamed product');
  const brand=document.createElement('p');brand.textContent=safeText(product.brands,'Brand not listed');
  const meta=document.createElement('p');meta.className='product-meta';meta.textContent=`${product.sourceLabel|| (isIndiaProduct(product)?'India-tagged listing':'Open Food Facts')} · Nutri-Score: ${gradeLabel(product.nutriscore_grade||product.nutrition_grades)} · Barcode: ${safeText(product.code,'Not listed')}`;
  const choose=document.createElement('button');choose.type='button';choose.className='secondary-btn';choose.textContent='Use this product';choose.addEventListener('click',()=>useProduct(product));
  details.append(title,brand,meta,choose);card.append(details);matchesEl.append(card);
 });
}
async function searchProducts(name,brand) {
 matchesEl.hidden=true;matchesEl.innerHTML='';setSearchStatus('Searching available food databases…');$('productSearchBtn').disabled=true;
 const terms=[name.trim(),brand.trim()].filter(Boolean).join(' ');
 const offSearch=async(indiaOnly)=>{
  const params=new URLSearchParams({search_terms:terms,...(indiaOnly?{countries_tags:'en:india'}:{})});
  const response=await fetch(`${OFF_API}?${params.toString()}`,{headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error(`Open Food Facts returned HTTP ${response.status}`);
  const data=await response.json();
  return (data.products||[]).filter(p=>p.product_name&&p.nutriments).map(p=>({...p,source:'off',sourceLabel:'Open Food Facts'}));
 };
 const usdaSearch=async()=>{
  const response=await fetch(`/api/usda?query=${encodeURIComponent(terms)}`,{headers:{Accept:'application/json'}});
  if(!response.ok) { const err=await response.json().catch(()=>({})); throw new Error(err.error||`USDA returned HTTP ${response.status}`); }
  const data=await response.json();
  return (data.products||[]).map(p=>({...p,source:'usda',sourceLabel:'USDA FoodData Central'}));
 };
 const settled=await Promise.allSettled([offSearch(true),usdaSearch()]);
 let offProducts=[],usdaProducts=[],errors=[];
 if(settled[0].status==='fulfilled')offProducts=settled[0].value;else errors.push(settled[0].reason.message);
 if(settled[1].status==='fulfilled')usdaProducts=settled[1].value;else errors.push(settled[1].reason.message);
 if(!offProducts.length && settled[0].status==='fulfilled'){
  try{offProducts=await offSearch(false);}catch(error){errors.push(error.message);}
 }
 offProducts.sort((a,b)=>Number(isIndiaProduct(b))-Number(isIndiaProduct(a)));
 const products=[...offProducts,...usdaProducts].slice(0,24);
 showProductMatches(products);
 if(products.length) setSearchStatus(`Found ${products.length} possible match(es). Sources: ${[offProducts.length?'Open Food Facts':'',usdaProducts.length?'USDA FoodData Central':''].filter(Boolean).join(' and ')}. Confirm the exact food and label before using the values.`);
 else setSearchStatus(`No results returned. ${errors.length?errors.join(' · '):'Try a shorter name or upload the nutrition label.'}`,true);
 $('productSearchBtn').disabled=false;
}
searchForm.addEventListener('submit',event=>{event.preventDefault();const name=$('productName').value.trim();if(name.length<2){setSearchStatus('Enter the product name as printed on the packet.',true);return;}searchProducts(name,$('productBrand').value);});
function useProduct(product) {
 const values=productToNutrients(product);
 if(!Object.values(values).some(v=>v!==null)){setSearchStatus('This database entry does not contain enough nutrition information. Try another result or upload the label.',true);return;}
 extracted=values;renderNutrients(values);
 $('rawText').value=`Product: ${product.product_name||''}\nBrand: ${product.brands||''}\nSource: ${product.sourceLabel||'Open Food Facts'}\nBarcode: ${product.code||''}\nNutri-Score: ${product.nutriscore_grade||product.nutrition_grades||'not provided'}\nNutrient values are mapped from database values per 100 g/ml where available.`;
 $('resultSource').textContent=`Selected: ${product.product_name||'Product'}${product.brands?' · '+product.brands:''}. Source: ${product.sourceLabel||'Open Food Facts'}; data coverage varies; verify against the package label.`;
 $('results').hidden=false;renderScore(null);$('results').scrollIntoView({behavior:'smooth',block:'start'});
}

const fileInput = $('fileInput'), dropzone = $('dropzone'), preview = $('preview');
let selectedFile = null, extracted = {};
const nutrients = [
  {key:'sugar',label:'Total sugars',unit:'g',hint:'Lower is generally preferable'},
  {key:'saturatedFat',label:'Saturated fat',unit:'g',hint:'Lower is generally preferable'},
  {key:'sodium',label:'Sodium',unit:'mg',hint:'Lower is generally preferable'},
  {key:'protein',label:'Protein',unit:'g',hint:'Can contribute positively'},
  {key:'fiber',label:'Dietary fiber',unit:'g',hint:'Can contribute positively'},
  {key:'calories',label:'Energy',unit:'kcal',hint:'Compare similar products'},
  {key:'totalFat',label:'Total fat',unit:'g',hint:'Consider fat type too'},
  {key:'serving',label:'Serving size',unit:'g/ml',hint:'Use label serving size if known'}
];
function setFile(file){
  $('error').hidden=true;
  if(!file)return;
  if(!/^image\/(png|jpeg|webp)$/.test(file.type)){showError('Choose a PNG, JPG, or WEBP image.');return;}
  if(file.size>10*1024*1024){showError('Image is larger than 10 MB. Please choose a smaller image.');return;}
  selectedFile=file; preview.src=URL.createObjectURL(file); preview.hidden=false; $('uploadContent').hidden=true; $('removeImage').hidden=false; $('analyzeBtn').disabled=false;
}
function resetUpload(){selectedFile=null;fileInput.value='';preview.src='';preview.hidden=true;$('uploadContent').hidden=false;$('removeImage').hidden=true;$('analyzeBtn').disabled=true;$('progressWrap').hidden=true;$('results').hidden=true;$('error').hidden=true;}
function showError(message){$('error').textContent=message;$('error').hidden=false;}
$('browseBtn').addEventListener('click',e=>{e.stopPropagation();fileInput.click()});dropzone.addEventListener('click',()=>{if(!selectedFile)fileInput.click()});dropzone.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!selectedFile){e.preventDefault();fileInput.click()}});fileInput.addEventListener('change',()=>setFile(fileInput.files[0]));
$('removeImage').addEventListener('click',e=>{e.stopPropagation();resetUpload()});['dragenter','dragover'].forEach(type=>dropzone.addEventListener(type,e=>{e.preventDefault();dropzone.classList.add('dragging')}));['dragleave','drop'].forEach(type=>dropzone.addEventListener(type,e=>{e.preventDefault();dropzone.classList.remove('dragging')}));dropzone.addEventListener('drop',e=>setFile(e.dataTransfer.files[0]));
function progress(pct,msg){$('progressWrap').hidden=false;$('progressBar').style.width=pct+'%';$('progressPct').textContent=Math.round(pct)+'%';$('progressText').textContent=msg;}
$('analyzeBtn').addEventListener('click',async()=>{
 if(!selectedFile)return; $('analyzeBtn').disabled=true;$('error').hidden=true;
 try{
  if(!window.Tesseract)throw new Error('OCR library did not load. Check your internet connection and reload the page.');
  const result=await Tesseract.recognize(selectedFile,'eng',{logger:m=>{if(m.status==='recognizing text')progress(m.progress*100,'Reading printed label…');else if(m.status==='loading language traineddata')progress(10+m.progress*20,'Loading text recognition…');}});
  $('rawText').value=result.data.text||''; $('resultSource').textContent='Values extracted from your uploaded label. Review them before scoring.'; extracted=parseNutrition(result.data.text||''); renderNutrients(extracted); $('results').hidden=false; $('results').scrollIntoView({behavior:'smooth',block:'start'}); renderScore(null);
  if(!Object.values(extracted).some(v=>v!==null))showError('The image was processed, but no common nutrition values were detected. Try a sharper, closer photo or edit the recognized text below.');
 }catch(err){showError(err.message||'Could not read this image. Try another photo.');}
 finally{$('analyzeBtn').disabled=false;progress(100,'Analysis complete');setTimeout(()=>$('progressWrap').hidden=true,800);}
});
function findValue(text,patterns){for(const pattern of patterns){const m=text.match(pattern);if(m){const n=Number(m[1].replace(',','.'));if(Number.isFinite(n))return n;}}return null;}
function parseNutrition(raw){
 const t=raw.toLowerCase().replace(/\u00a0/g,' ').replace(/,/g,'.');
 const value=(names,unit='g')=>{for(const name of names){const re=new RegExp('(?:'+name+')[^\\n\\d]{0,28}([0-9]+(?:\\.[0-9]+)?)\\s*(kcal|kj|mg|mcg|µg|g)?','i');const m=t.match(re);if(m){let n=Number(m[1]),u=(m[2]||unit).toLowerCase();if(u==='mg'&&unit==='g')n/=1000;if(u==='g'&&unit==='mg')n*=1000;if(u==='kj')n/=4.184;return n;}}return null;};
 return {sugar:value(['total sugars','sugars','sugar']),saturatedFat:value(['saturated fat','saturates']),sodium:value(['sodium'],'mg'),protein:value(['protein']),fiber:value(['dietary fibre','dietary fiber','fibre','fiber']),calories:value(['energy','calories'],'kcal'),totalFat:value(['total fat','fat']),serving:value(['serving size','serve size'],'g')};
}
function renderNutrients(values){$('nutrientGrid').innerHTML='';nutrients.forEach(n=>{const wrap=document.createElement('div');wrap.className='nutrient-item';const label=document.createElement('label');label.textContent=n.label;label.htmlFor='nutrient-'+n.key;const row=document.createElement('div');row.className='nutrient-input';const input=document.createElement('input');input.id='nutrient-'+n.key;input.type='number';input.min='0';input.step='any';input.inputMode='decimal';input.placeholder='Unknown';input.value=values[n.key]??'';input.dataset.key=n.key;input.setAttribute('aria-label',n.label);const unit=document.createElement('span');unit.textContent=n.unit;row.append(input,unit);const hint=document.createElement('small');hint.textContent=n.hint;wrap.append(label,row,hint);$('nutrientGrid').append(wrap);});}
function getValues(){const out={};nutrients.forEach(n=>{const v=$('nutrient-'+n.key)?.value;out[n.key]=v===''||v===undefined?null:Number(v);});return out;}
$('scoreBtn').addEventListener('click',()=>renderScore(getValues()));
function renderScore(values){
 if(!values){
  $('scoreValue').textContent='—';$('ratingLabel').textContent='Review label values';
  $('scoreSummary').textContent='Check the extracted values and calculate your estimate.';
  $('scoreRing').style.background='conic-gradient(#246b4c 0deg,#e8eee5 0deg)';
  renderInsights(null);return;
 }
 // Educational heuristic only. Thresholds are approximate screening cues per 100 g/ml,
 // not official medical cut-offs. Unknown values are excluded, never treated as zero.
 let score=70, used=0;const impacts=[];
 const highReasons=[
  {key:'sugar',threshold:15,title:'High sugar',reason:v=>`Contains ${v} g of sugar per 100 g/ml. That is a relatively high amount, so this nutrient lowers the estimate.`},
  {key:'saturatedFat',threshold:5,title:'High saturated fat',reason:v=>`Contains ${v} g of saturated fat per 100 g/ml. Higher saturated fat is a reason to compare alternatives.`},
  {key:'sodium',threshold:600,title:'High sodium',reason:v=>`Contains ${v} mg of sodium per 100 g/ml. This is relatively high and contributes to the lower rating.`},
  {key:'calories',threshold:500,title:'High energy density',reason:v=>`Provides ${v} kcal per 100 g/ml. This is energy-dense, so portion size matters when comparing products.`},
  {key:'totalFat',threshold:25,title:'High total fat',reason:v=>`Contains ${v} g of total fat per 100 g/ml. Check the saturated-fat value too, because fat type matters.`}
 ];
 function penalty(key,limit,weight){const v=values[key];if(v===null||!Number.isFinite(v))return;used++;score-=Math.min(1,v/limit)*weight;}
 function bonus(key,threshold,weight){const v=values[key];if(v===null||!Number.isFinite(v))return;used++;score+=Math.min(1,v/threshold)*weight;}
 penalty('sugar',15,22);penalty('saturatedFat',5,18);penalty('sodium',600,18);penalty('calories',500,7);penalty('totalFat',25,5);
 bonus('fiber',6,10);bonus('protein',10,10);
 if(!used){$('scoreValue').textContent='—';$('ratingLabel').textContent='More data needed';$('scoreSummary').textContent='Enter at least one nutrient value to get a rough estimate.';renderInsights(null);return;}
 score=Math.max(0,Math.min(100,Math.round(score)));
 const label=score>=80?'Better choice':score>=65?'Fair':score>=45?'Occasional choice':'Limit often';
 const color=score>=80?'#3c8a58':score>=65?'#9aaf49':score>=45?'#c58b35':'#bd554b';
 $('scoreValue').textContent=score;$('ratingLabel').textContent=label;
 $('scoreSummary').textContent=`This estimate used ${used} available nutrient field(s). ${score<45?'The rating is low because the combined nutrient values reduced the score.':score<65?'Some nutrient values lowered the score; see the reasons below.':'Compare similar products and check the full ingredient list.'}`;
 $('scoreRing').style.background=`conic-gradient(${color} ${score*3.6}deg,#e8eee5 ${score*3.6}deg)`;
 highReasons.forEach(item=>{const v=values[item.key];if(v!==null&&Number.isFinite(v)&&v>=item.threshold)impacts.push({type:'warn',title:item.title,text:item.reason(v)});});
 if(values.fiber!==null&&Number.isFinite(values.fiber)){
  if(values.fiber<3)impacts.push({type:'info',title:'Low dietary fiber',text:`Contains ${values.fiber} g of fiber per 100 g/ml. This is a low amount; fiber can be a useful positive feature when comparing similar foods.`});
  else if(values.fiber>=6)impacts.push({type:'good',title:'Good fiber contribution',text:`Contains ${values.fiber} g of fiber per 100 g/ml, which is a positive feature in this estimate.`});
 }
 if(values.protein!==null&&Number.isFinite(values.protein)&&values.protein>=10)impacts.push({type:'good',title:'Protein contribution',text:`Contains ${values.protein} g of protein per 100 g/ml, which contributes positively to this estimate.`});
 if(impacts.length===0)impacts.push({type:'info',title:score<65?'Why the rating may be low':'No standout warning detected',text:score<65?'The combined scoring formula can lower the rating even when no single nutrient crosses the high-level guide above. Check the entered values and make sure they are per 100 g/ml, not per serving.':'None of the available values crossed the high-level guide used here. This does not automatically mean the food is healthy; check ingredients, serving size, and missing nutrients.'});
 renderInsights(impacts);
}
function renderInsights(items){const el=$('insights');el.innerHTML='';if(!items){items=[{type:'info',title:'Nutrition data',text:'Your results will appear here after you calculate a score.'},{type:'info',title:'Ingredients',text:'OCR text can be edited below. Allergens are not reliably identified by this score.'},{type:'info',title:'Compare products',text:'Use the same basis (per 100 g/ml or per serving) when comparing similar foods.'}];}items.slice(0,6).forEach(item=>{const card=document.createElement('div');card.className='insight insight-'+item.type;const icon=document.createElement('span');icon.className='insight-icon';icon.textContent=item.type==='good'?'＋':item.type==='warn'?'!':'ⓘ';const title=document.createElement('b');title.textContent=item.title;const p=document.createElement('p');p.textContent=item.text;card.append(icon,title,p);el.append(card);});}
$('reparseBtn').addEventListener('click',()=>{extracted=parseNutrition($('rawText').value);renderNutrients(extracted);renderScore(null);$('results').scrollIntoView({behavior:'smooth',block:'start'});});$('resetBtn').addEventListener('click',resetUpload);
