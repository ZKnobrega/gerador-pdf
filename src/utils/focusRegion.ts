import {
  TutorialProject,
  StepImage,
  getStepImages,
  computeFocusRegionFromAnnotations,
  FOCUS_ANCHOR_TYPES,
} from '../types/tutorial';

/** Reads the natural pixel size of a data URL / image source. */
function loadImageSize(src: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function needsAutoFocus(img: StepImage): boolean {
  if (!img.url) return false;
  // Respect anything the user already decided for this image
  if (img.focusRegion) return false;
  return (img.annotations || []).some((s) => FOCUS_ANCHOR_TYPES.includes(s.type));
}

/**
 * RF-17 — Automatic focus on the click.
 *
 * Walks the project and, for every screenshot that already carries click /
 * action annotations but no focus region yet, derives the region from those
 * clicks. Images the user has explicitly configured (or turned off) are left
 * untouched, and the screenshots themselves are never modified.
 *
 * Returns the updated project, or null when nothing changed.
 */
export async function applyAutomaticFocusRegions(
  project: TutorialProject
): Promise<TutorialProject | null> {
  if (!project || !Array.isArray(project.steps)) return null;

  // Collect the work first so we only decode the images that actually need it
  const pending: { stepId: string; imageId: string; url: string }[] = [];
  project.steps.forEach((step) => {
    getStepImages(step).forEach((img) => {
      if (needsAutoFocus(img)) {
        pending.push({ stepId: step.id, imageId: img.id, url: img.url });
      }
    });
  });

  if (pending.length === 0) return null;

  const sizes = new Map<string, { width: number; height: number } | null>();
  await Promise.all(
    pending.map(async (job) => {
      sizes.set(`${job.stepId}::${job.imageId}`, await loadImageSize(job.url));
    })
  );

  let changed = false;

  const updatedSteps = project.steps.map((step) => {
    const images = getStepImages(step);
    if (images.length === 0) return step;

    let stepChanged = false;
    const updatedImages = images.map((img) => {
      if (!needsAutoFocus(img)) return img;

      const size = sizes.get(`${step.id}::${img.id}`);
      if (!size || !size.width || !size.height) return img;

      const region = computeFocusRegionFromAnnotations(
        img.annotations,
        size.width,
        size.height
      );
      if (!region) return img;

      stepChanged = true;
      changed = true;
      return { ...img, focusRegion: region };
    });

    if (!stepChanged) return step;
    return {
      ...step,
      images: updatedImages,
      image: updatedImages[0]?.url || step.image || null,
    };
  });

  if (!changed) return null;

  return { ...project, steps: updatedSteps };
}
