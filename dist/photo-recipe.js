import { PHOTO_DEFAULTS, PHOTO_FIELDS } from "./photo-settings.js";
function validatePhotoRecipe(recipe, assertSource) {
  if (!recipe || recipe.version !== 1 || !Object.hasOwn(PHOTO_FIELDS, recipe.mode) || !recipe.params || typeof recipe.params !== "object") throw new Error("Invalid photo recipe.");
  assertSource(recipe.source);
  if (recipe.originId !== void 0 && typeof recipe.originId !== "string") throw new Error("Invalid photo source identity.");
  for (const [key, value] of Object.entries(recipe.params)) {
    if (!Object.hasOwn(PHOTO_DEFAULTS, key)) throw new Error("Unknown photo parameter.");
    if (typeof PHOTO_DEFAULTS[key] === "number" && (!Number.isFinite(value) || Math.abs(value) > 100)) throw new Error("Invalid photo parameter.");
    if(['faceSlim','jawSlim','chinSlim','shine','shineSensitivity'].includes(key)&&value<0)throw new Error('Invalid photo parameter.');
    if (typeof PHOTO_DEFAULTS[key] === "boolean" && typeof value !== "boolean") throw new Error("Invalid photo parameter.");
    if (["irisColor", "hairColor", "beardColor"].includes(key) && (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value))) throw new Error("Invalid photo color.");
    if (key === "irisSide" && !["both", "left", "right"].includes(value) || key === "beardStyle" && !["none", "stubble", "moustache", "chin", "goatee", "boxed", "full"].includes(value)) throw new Error("Invalid portrait style.");
  }
  if (!["all", "face", "body", "manual"].includes(recipe.params.scope) || typeof recipe.params.protect !== "boolean" || typeof recipe.params.keepFreckles !== "boolean" || !Number.isInteger(recipe.params.faceIndex) || recipe.params.faceIndex < 0 || recipe.params.faceIndex > 7) throw new Error("Invalid photo region.");
  const faces = recipe.analysis?.faces || [];
  if (!Array.isArray(faces) || faces.length > 8 || faces.some((f) => !Array.isArray(f.points) || f.points.length !== 478 || f.points.some((p) => !Number.isFinite(p.x + p.y + (p.z || 0)) || Math.abs(p.x) > 10 || Math.abs(p.y) > 10) || !f.box || Object.values(f.box).some((n) => !Number.isFinite(n) || Math.abs(n) > 10))) throw new Error("Invalid facial landmarks.");
  if (recipe.analysis?.skinSource) assertSource(recipe.analysis.skinSource);
  if (recipe.analysis?.partsVersion !== undefined && recipe.analysis.partsVersion !== 1) throw new Error("Invalid portrait mask version.");
  if (recipe.selectionSource) assertSource(recipe.selectionSource);
  if (!Array.isArray(recipe.strokes) || recipe.strokes.length > 80 || recipe.strokes.reduce((n, s) => n + (s.points?.length || 0), 0) > 2e4 || recipe.strokes.some((s) => !["skin", "damage", "hair", "beard"].includes(s.type) || typeof s.add !== "boolean" || !Number.isFinite(s.radius) || s.radius < 1e-3 || s.radius > 0.3 || !Array.isArray(s.points) || s.points.length < 1 || s.points.some((p) => !Array.isArray(p) || p.length !== 2 || p.some((n) => !Number.isFinite(n) || n < 0 || n > 1)))) throw new Error("Invalid photo refinement strokes.");
  if (recipe.eyePoints !== undefined && (!Array.isArray(recipe.eyePoints) || recipe.eyePoints.length > 16 || recipe.eyePoints.some(p => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1 || !Number.isFinite(p.radius) || p.radius < .001 || p.radius > .1))) throw new Error("Invalid manual eye points.");
  return recipe;
}
export {
  PHOTO_DEFAULTS,
  PHOTO_FIELDS,
  validatePhotoRecipe
};
