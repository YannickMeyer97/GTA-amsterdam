// Ticket 118 (v0.23, ronde 9 — Zombie V2 fundament): structuurchecks voor de
// SkinnedMesh-/botskelet-architectuur. Uitsluitend structuur — GEEN
// gameplay-asserts (schade/hitdetectie komen in T120, zie de ticket-spec in
// SONNET_EXECUTION_PLAN.md).
// Ticket 119 voegde 'pelvis'/'chest' toe aan het skelet (9 botten i.p.v. 7)
// — de bonecount-checks hieronder zijn bijgewerkt naar die nieuwe telling;
// de animatiechecks zelf (pelvis-sway/chest-lag) staan in
// test-ondode-animatie.mjs, bij de rest van de loop-animatietests.
// Ticket 129: de vroegere V1-architectuur en de V1/V2-toggle zijn verwijderd
// — spawnOndode() bouwt altijd deze architectuur, dus de tests hieronder
// spawnen gewoon rechtstreeks (geen zetZombieRenderVersie() meer nodig).
import { openAmsterdamUndead, makeChecker } from './helpers.mjs';

const { browser, page, errs } = await openAmsterdamUndead();
const { check, report } = makeChecker();

// --- 2. bouwOndodeGeometrieV2()/bouwOndodeBotstructuurV2() zijn pure
// functies: testbaar zonder een ondode te spawnen, zonder scene ------------
const pureFunctieTest = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const bones = d.bouwOndodeBotstructuurV2();
  const boneNamen = d.V2_BOTNAMEN.filter(n => n !== 'root');
  const geo = d.bouwOndodeGeometrieV2(
    boneNamen.map(naam => ({ boneNaam: naam, geometrie: new d.THREE.BoxGeometry(0.1, 0.1, 0.1), tint: 1 }))
  );
  return {
    boneCount: Object.keys(bones).length,   // root + 8 (Ticket 119: + pelvis/chest)
    alleZijnBones: Object.values(bones).every(b => b.isBone === true),
    rootIsParentVanAlleAnderen: boneNamen.every(n => bones[n].parent === bones.root),
    rootHeeftGeenEigenParent: bones.root.parent === null,
    geoHeeftSkinIndex: !!geo.attributes.skinIndex,
    geoHeeftSkinWeight: !!geo.attributes.skinWeight,
    geoHeeftColor: !!geo.attributes.color,
    // 8 delen x 24 vertices (BoxGeometry) = 192
    vertexCount: geo.attributes.position.count,
  };
});
check('bouwOndodeBotstructuurV2() geeft 9 botten (root + 8)', pureFunctieTest.boneCount === 9, pureFunctieTest);
check('Alle geretourneerde objecten zijn THREE.Bone-instanties', pureFunctieTest.alleZijnBones, pureFunctieTest);
check("De 8 niet-root-botten zijn 'plat' — direct kind van root, geen keten", pureFunctieTest.rootIsParentVanAlleAnderen, pureFunctieTest);
check('root zelf heeft geen parent (is de skeleton-wortel)', pureFunctieTest.rootHeeftGeenEigenParent, pureFunctieTest);
check('bouwOndodeGeometrieV2() voegt skinIndex toe', pureFunctieTest.geoHeeftSkinIndex, pureFunctieTest);
check('bouwOndodeGeometrieV2() voegt skinWeight toe', pureFunctieTest.geoHeeftSkinWeight, pureFunctieTest);
check('bouwOndodeGeometrieV2() voegt een color-attribuut toe (T104-achtige tint)', pureFunctieTest.geoHeeftColor, pureFunctieTest);
check('bouwOndodeGeometrieV2() merget daadwerkelijk (8 BoxGeometry x 24 vertices = 192)', pureFunctieTest.vertexCount === 192, pureFunctieTest);

// --- 3. Botnamen en volgorde matchen V1 voor de eerste 7, + pelvis/chest
// (Ticket 119) achteraan toegevoegd -----------------------------------------
const botNamen = await page.evaluate(() => window.AmsterdamUndeadDebug.V2_BOTNAMEN);
check("V2_BOTNAMEN = ['root','beenL','beenR','romp','hoofd','armL','armR','pelvis','chest']",
  JSON.stringify(botNamen) === JSON.stringify(['root', 'beenL', 'beenR', 'romp', 'hoofd', 'armL', 'armR', 'pelvis', 'chest']), botNamen);

// --- 4. Een echte V2-spawn: SkinnedMesh + Skeleton + delen.*-contract ------
const spawnStructuur = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const ondode = d.spawnOndode(0, 'normaal');
  const delen = ondode.delen;
  const uit = {
    isSkinnedMesh: delen.skinnedMesh.isSkinnedMesh === true,
    skeletonBoneCount: delen.skeleton.bones.length,
    skeletonBoneNamen: delen.skeleton.bones.map(b => b.name),
    armLIsBone: delen.armL.isBone === true,
    armRIsBone: delen.armR.isBone === true,
    beenLIsBone: delen.beenL.isBone === true,
    beenRIsBone: delen.beenR.isBone === true,
    rompIsBone: delen.romp.isBone === true,
    hoofdIsBone: delen.hoofd.isBone === true,
    pelvisIsBone: delen.pelvis?.isBone === true,   // Ticket 119
    chestIsBone: delen.chest?.isBone === true,     // Ticket 119
    huidMaterialenLength: delen.huidMaterialen.length,
    oogMateriaalBestaat: !!delen.oogMateriaal,
    // T118 bouwt bewust nog geen bochel/buik/kern (T121/T126/T127) — moet
    // undefined blijven, en alle bestaande aanroepers hebben al een guard.
    kernBestaatNiet: delen.kern === undefined,
    rompHeeftBaseY: typeof delen.romp.userData.baseY === 'number',
    hoofdHeeftBaseRotX: typeof delen.hoofd.userData.baseRotX === 'number',
    skinIndexAanwezig: !!delen.skinnedMesh.geometry.attributes.skinIndex,
    skinWeightAanwezig: !!delen.skinnedMesh.geometry.attributes.skinWeight,
    materiaalHeeftVertexColors: delen.huidMaterialen[0].vertexColors === true,
    groepInOndodenGroep: d.ondodenGroep.children.includes(ondode.groep),
  };
  d.doodOndode(ondode);
  return uit;
});
check('delen.skinnedMesh is een echte THREE.SkinnedMesh', spawnStructuur.isSkinnedMesh, spawnStructuur);
check('skeleton.bones.length is 9 (Ticket 119: + pelvis/chest)', spawnStructuur.skeletonBoneCount === 9, spawnStructuur);
check('skeleton-botnamen matchen V2_BOTNAMEN exact (zelfde volgorde = skinIndex-contract)',
  JSON.stringify(spawnStructuur.skeletonBoneNamen) === JSON.stringify(['root', 'beenL', 'beenR', 'romp', 'hoofd', 'armL', 'armR', 'pelvis', 'chest']),
  spawnStructuur);
check('delen.armL/armR/beenL/beenR/romp/hoofd zijn allemaal THREE.Bone-instanties (V1-sleutelnamen, nu op een bot)',
  spawnStructuur.armLIsBone && spawnStructuur.armRIsBone && spawnStructuur.beenLIsBone &&
  spawnStructuur.beenRIsBone && spawnStructuur.rompIsBone && spawnStructuur.hoofdIsBone, spawnStructuur);
check('delen.pelvis/delen.chest bestaan en zijn THREE.Bone-instanties (Ticket 119)',
  spawnStructuur.pelvisIsBone && spawnStructuur.chestIsBone, spawnStructuur);
check('delen.huidMaterialen heeft precies 1 materiaal (was tot 11 in V1)', spawnStructuur.huidMaterialenLength === 1, spawnStructuur);
check('delen.oogMateriaal bestaat (ongewijzigd t.o.v. V1 — eigen materiaal, geen vertex-color-blending)', spawnStructuur.oogMateriaalBestaat, spawnStructuur);
check('delen.kern bestaat NIET (bochel/buik/kern zijn T121/T126/T127, bewust niet dit ticket)', spawnStructuur.kernBestaatNiet, spawnStructuur);
check('delen.romp.userData.baseY bestaat (Ticket 20-conventie, nu op het bot)', spawnStructuur.rompHeeftBaseY, spawnStructuur);
check('delen.hoofd.userData.baseRotX bestaat (Ticket 20-conventie, nu op het bot)', spawnStructuur.hoofdHeeftBaseRotX, spawnStructuur);
check('De samengestelde geometrie heeft skinIndex/skinWeight-attributen', spawnStructuur.skinIndexAanwezig && spawnStructuur.skinWeightAanwezig, spawnStructuur);
check('Het huidmateriaal heeft vertexColors:true (voor de per-deel T104-achtige tint)', spawnStructuur.materiaalHeeftVertexColors, spawnStructuur);
check('De V2-groep staat gewoon in ondodenGroep (zelfde contract als V1)', spawnStructuur.groepInOndodenGroep, spawnStructuur);

// --- 4b. Rustpose-hoogte-anker: de SkinnedMesh's RUWE (ongeskinde) vertex-
// data moet al de eindpositie zijn (voeten bij y≈0, hoofdtop bij y≈1,76 —
// hoofdcentrum 1,58 + straal 0,18). Dit ving een echte bug bij het bouwen
// van dit ticket: skinning rendert een vertex in de rustpose op precies
// zijn AUTHORED (mesh-space) positie, ONGEACHT welk bot 'm beïnvloedt — een
// eerdere versie translate()de elk deel t.o.v. zijn EIGEN bot-positie
// (zoals V1's Group-nesting dat zou doen), wat een ondode gaf die met de
// voeten rond y=-0,8 (onder de grond) en het hoofd rond y=0,3 stond. Zonder
// deze check zou dat een stille, alleen-met-het-oog-zichtbare regressie
// zijn — precies wat de ticket-spec's "screenshot-vergelijking" bedoelt,
// hier machinaal gevangen i.p.v. op ooghoogte gecontroleerd.
const hoogteAnker = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const ondode = d.spawnOndode(0, 'normaal');
  ondode.groep.scale.set(1, 1, 1);   // vaste schaal, geen willekeurige variatie voor deze meting
  ondode.delen.skinnedMesh.geometry.computeBoundingBox();
  const bb = ondode.delen.skinnedMesh.geometry.boundingBox;
  d.ondodenGroep.remove(ondode.groep);
  return { minY: bb.min.y, maxY: bb.max.y };
});
check('De RUWE (ongeskinde) geometrie staat al op de juiste rustpose-hoogte: voeten bij y≈0',
  Math.abs(hoogteAnker.minY - 0) < 0.05, hoogteAnker);
check('De RUWE (ongeskinde) geometrie staat al op de juiste rustpose-hoogte: hoofdtop bij y≈1,76 (1,58 + straal 0,18)',
  Math.abs(hoogteAnker.maxY - 1.76) < 0.05, hoogteAnker);

// --- 5. raakOndode()/doodOndode() blijven ONGEWIJZIGD werken tegen een V2-
// ondode: flinch bij een overlevende treffer, val-animatie + dispose bij een
// dodelijke treffer — geen van beide functies is aangepast in dit ticket,
// dit toetst dat het bestaande V1-pad ook tegen V2 werkt. ---
const gameplayPad = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;

  // Overlevende treffer: flinch-state moet gezet worden, geen crash.
  const overlevend = d.spawnOndode(0, 'normaal');
  overlevend.hp = 999;
  overlevend.groep.position.set(3, 0, 3);
  d.raakOndode(overlevend, overlevend.groep.position.clone(), false);
  const flinchGezet = !!overlevend.flinch;
  const nogInOndodenNaFlinch = d.ondoden.includes(overlevend);
  d.doodOndode(overlevend);

  // Dodelijke treffer: ondode verhuist naar stervenden, en de
  // val-animatie/dispose loopt af zonder fout.
  const dodelijk = d.spawnOndode(0, 'normaal');
  dodelijk.hp = 1;
  dodelijk.groep.position.set(4, 0, 4);
  d.raakOndode(dodelijk, dodelijk.groep.position.clone(), true);   // headshot, hp=1 -> gegarandeerd dodelijk
  const nietMeerInOndoden = !d.ondoden.includes(dodelijk);
  const inStervenden = d.stervenden.some(s => s.huidMaterialen === dodelijk.delen.huidMaterialen);
  for (let i = 0; i < 60; i++) d.updateStervenden(1 / 60);   // laat STERVEN_DUUR (0.7s) volledig aflopen
  const stervendenOpgeruimd = d.stervenden.length === 0;

  return { flinchGezet, nogInOndodenNaFlinch, nietMeerInOndoden, inStervenden, stervendenOpgeruimd };
});
check('Een overlevende treffer zet flinch op een V2-ondode (raakOndode() ongewijzigd, werkt tegen een bot)',
  gameplayPad.flinchGezet, gameplayPad);
check('Na een overlevende treffer staat de V2-ondode nog gewoon in ondoden', gameplayPad.nogInOndodenNaFlinch, gameplayPad);
check('Na een dodelijke treffer staat de V2-ondode niet meer in ondoden', gameplayPad.nietMeerInOndoden, gameplayPad);
check('De V2-ondode verhuist naar stervenden (val-animatie-pad ongewijzigd)', gameplayPad.inStervenden, gameplayPad);
check('Na STERVEN_DUUR is de V2-ondode volledig opgeruimd (ruimGroepOp() disposet SkinnedMesh + Skeleton zonder fout)',
  gameplayPad.stervendenOpgeruimd, gameplayPad);

// --- 6. Skeleton-dispose-contract (Ticket 118: "controleer expliciet of het
// bestaande T70-dispose-pad een Skeleton al meeneemt of dat dit een nieuwe
// disposeregel nodig heeft") — geometrie/materiaal EN het skeleton's eigen
// boneTexture moeten allemaal disposed zijn na ruimGroepOp(). --------------
const disposeContract = await page.evaluate(() => {
  const d = window.AmsterdamUndeadDebug;
  const ondode = d.spawnOndode(0, 'normaal');
  const { skinnedMesh, skeleton, huidMaterialen } = ondode.delen;
  // Forceer een boneTexture (Skeleton bouwt 'm lazy, bij updateMatrixWorld/
  // getBoneTexture) zodat dispose() ook echt iets aantoonbaars opruimt.
  skeleton.computeBoneTexture();
  const boneTextureVoorDispose = skeleton.boneTexture;
  d.ondodenGroep.remove(ondode.groep);   // zelfde eerste stap als doodOndode()
  d.ruimGroepOp(ondode.groep);
  return {
    boneTextureBestondVoorDispose: !!boneTextureVoorDispose,
    boneTextureNaDispose: skeleton.boneTexture,
    geometryDisposed: skinnedMesh.geometry.attributes.position === undefined || skinnedMesh.geometry.userData.disposedMarker === true,
    materiaalNietGedeeld: !huidMaterialen[0].userData?.gedeeld,
  };
});
check('Skeleton had een boneTexture vóór dispose (geen no-op test)', disposeContract.boneTextureBestondVoorDispose, disposeContract);
check('ruimGroepOp() disposet skeleton.boneTexture (skeleton.boneTexture === null erna)',
  disposeContract.boneTextureNaDispose === null, disposeContract);
check('De per-instance SkinnedMesh-geometrie is niet gedeeld/gecachet (moet dus echt disposen)',
  disposeContract.materiaalNietGedeeld, disposeContract);

const fails = report(errs);
await browser.close();
process.exit(fails > 0 ? 1 : 0);
