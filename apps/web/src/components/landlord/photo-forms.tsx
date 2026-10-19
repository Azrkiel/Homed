'use client';
import { useActionState } from 'react';
import { Button, Checkbox, Field, Select, TextInput } from '@/components/ui';
import { deletePhotoAction, savePhotoAction } from '@/lib/landlord/actions';
import { FormAlert } from './form-alert';

/**
 * Add a photo by URL. Form names: propertyId, url, alt, floorPlanId (optional, blank = whole property),
 * credit (optional, e.g. "Wikimedia Commons, CC BY-SA 4.0"), isRendering (checkbox: "This is a rendering, not a real photo").
 * Photos are never uploaded; the URL must be a full http(s) link.
 */
export function PhotoAddForm({ propertyId, floorPlans }: { propertyId: string; floorPlans: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(savePhotoAction, null);
  return (
    <form action={action} className="grid gap-5 sm:grid-cols-2">
      <input type="hidden" name="propertyId" value={propertyId} />
      <FormAlert state={state} />
      <Field id="ph-url" label="Image URL" required className="sm:col-span-2" hint="A full link to the image (https://...).">
        {(c) => <TextInput {...c} name="url" type="url" required maxLength={2000} placeholder="https://" />}
      </Field>
      <Field id="ph-alt" label="Description for screen readers" required hint="What the image shows, for example: Living room with a window facing the street.">
        {(c) => <TextInput {...c} name="alt" required maxLength={300} />}
      </Field>
      <Field id="ph-floor-plan" label="Applies to">
        {(c) => (
          <Select {...c} name="floorPlanId" defaultValue="">
            <option value="">Whole property</option>
            {floorPlans.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field id="ph-credit" label="Credit or license" hint="Needed for photos that require attribution.">
        {(c) => <TextInput {...c} name="credit" maxLength={200} />}
      </Field>
      <div className="sm:col-span-2">
        <Checkbox
          id="ph-rendering"
          name="isRendering"
          label="This is a rendering, not a real photo"
          hint="Architect drawings and computer renderings are labeled so students do not mistake them for the unit."
        />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" loading={pending}>
          Add photo
        </Button>
      </div>
    </form>
  );
}

/** Removes one photo. Hidden: propertyId, photoId. */
export function PhotoDeleteForm({ propertyId, photoId, alt }: { propertyId: string; photoId: string; alt: string }) {
  const [state, action, pending] = useActionState(deletePhotoAction, null);
  return (
    <form action={action} className="grid gap-1">
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="photoId" value={photoId} />
      <Button type="submit" variant="secondary" size="sm" loading={pending} aria-label={`Remove photo: ${alt}`}>
        Remove
      </Button>
      <FormAlert state={state} />
    </form>
  );
}
