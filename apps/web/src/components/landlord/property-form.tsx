'use client';
import { useActionState } from 'react';
import type { Property } from '@homed/core';
import { Button, Checkbox, Field, Select, Textarea, TextInput } from '@/components/ui';
import { savePropertyAction } from '@/lib/landlord/actions';
import { FormAlert } from './form-alert';
import { ListingStatusNote } from './listing-status-note';
import { LocationPicker } from './location-picker';

/**
 * Property editor (create when `property` is absent). Form names:
 * propertyId (hidden, edit only), name, slug, address, neighborhood, kind (apartment_complex | house),
 * website, yearBuilt, yearRenovated, noiseLevel (quiet | moderate | social), lat, lng,
 * amenity_gym, amenity_studyRooms, amenity_rooftop, amenity_pool, amenity_elevator,
 * amenity_parkingAvailable, parkingMonthly, amenity_petsAllowed, onBusRoute, busRoutes (comma or newline),
 * studyAbroadFriendly, noGuarantorOption, gradHeavy, litRouteToGrounds.
 */
export function PropertyForm({ property }: { property?: Property }) {
  const [state, action, pending] = useActionState(savePropertyAction, null);
  const a = property?.amenities;
  return (
    <form action={action} className="grid gap-8">
      {property && <input type="hidden" name="propertyId" value={property.id} />}
      <FormAlert state={state} />
      {property && <ListingStatusNote dataStatus={property.dataStatus} />}

      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-2 text-lg font-semibold text-ink">Basics</legend>
        <Field id="p-name" label="Property name" required>
          {(c) => <TextInput {...c} name="name" required maxLength={200} defaultValue={property?.name} />}
        </Field>
        <Field id="p-slug" label="URL name" hint="Leave blank to build it from the name. Lowercase letters, numbers and dashes.">
          {(c) => <TextInput {...c} name="slug" maxLength={200} defaultValue={property?.slug} />}
        </Field>
        <Field id="p-address" label="Street address" required className="sm:col-span-2">
          {(c) => <TextInput {...c} name="address" required maxLength={200} autoComplete="street-address" defaultValue={property?.address} />}
        </Field>
        <Field id="p-neighborhood" label="Neighborhood" required hint='For example "Rugby Road" or "Barracks Road".'>
          {(c) => <TextInput {...c} name="neighborhood" required maxLength={200} defaultValue={property?.neighborhood} />}
        </Field>
        <Field id="p-kind" label="Property type" required>
          {(c) => (
            <Select {...c} name="kind" defaultValue={property?.kind ?? 'apartment_complex'}>
              <option value="apartment_complex">Apartment complex</option>
              <option value="house">House</option>
            </Select>
          )}
        </Field>
        <Field id="p-website" label="Website">
          {(c) => <TextInput {...c} name="website" type="url" placeholder="https://" maxLength={2000} defaultValue={property?.website} />}
        </Field>
        <Field id="p-year-built" label="Year built">
          {(c) => <TextInput {...c} name="yearBuilt" type="number" inputMode="numeric" min={1800} max={2100} defaultValue={property?.yearBuilt} />}
        </Field>
        <Field id="p-year-renovated" label="Year renovated">
          {(c) => (
            <TextInput {...c} name="yearRenovated" type="number" inputMode="numeric" min={1800} max={2100} defaultValue={property?.yearRenovated} />
          )}
        </Field>
        <Field id="p-noise" label="Noise level">
          {(c) => (
            <Select {...c} name="noiseLevel" defaultValue={property?.noiseLevel ?? ''}>
              <option value="">Not sure</option>
              <option value="quiet">Quiet</option>
              <option value="moderate">Moderate</option>
              <option value="social">Social</option>
            </Select>
          )}
        </Field>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="mb-2 text-lg font-semibold text-ink">Location</legend>
        <p className="text-sm text-ink-2">
          Click the map to place the building, or type the coordinates. Homed does not look up addresses, so check the pin.
        </p>
        <LocationPicker lat={property?.location.lat} lng={property?.location.lng} />
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-lg font-semibold text-ink">Amenities</legend>
        <Checkbox id="p-am-gym" name="amenity_gym" label="Gym" defaultChecked={a?.gym} />
        <Checkbox id="p-am-study" name="amenity_studyRooms" label="Study rooms" defaultChecked={a?.studyRooms} />
        <Checkbox id="p-am-rooftop" name="amenity_rooftop" label="Rooftop or outdoor common space" defaultChecked={a?.rooftop} />
        <Checkbox id="p-am-pool" name="amenity_pool" label="Pool" defaultChecked={a?.pool} />
        <Checkbox id="p-am-elevator" name="amenity_elevator" label="Elevator" defaultChecked={a?.elevator} />
        <Checkbox id="p-am-pets" name="amenity_petsAllowed" label="Pets allowed" defaultChecked={a?.petsAllowed} />
        <Checkbox id="p-am-parking" name="amenity_parkingAvailable" label="Parking available" defaultChecked={a?.parkingAvailable} />
        <Field id="p-parking-monthly" label="Parking cost per space, per month (USD)" hint="0 for free parking. Leave blank if unknown.">
          {(c) => (
            <TextInput {...c} name="parkingMonthly" type="number" inputMode="numeric" min={0} max={5000} defaultValue={a?.parkingMonthly} />
          )}
        </Field>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="mb-2 text-lg font-semibold text-ink">Transit and walking</legend>
        <Checkbox id="p-bus" name="onBusRoute" label="On a bus route" defaultChecked={property?.onBusRoute} />
        <Field id="p-bus-routes" label="Bus route names" hint="Separate with commas or new lines, for example UTS Northline, CAT 7.">
          {(c) => <Textarea {...c} name="busRoutes" rows={2} defaultValue={property?.busRoutes.join(', ')} />}
        </Field>
        <Checkbox id="p-lit" name="litRouteToGrounds" label="Lit main-road walking route to Grounds" defaultChecked={property?.litRouteToGrounds} />
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="mb-2 text-lg font-semibold text-ink">Policies</legend>
        <Checkbox
          id="p-study-abroad"
          name="studyAbroadFriendly"
          label="Subletting allowed or a semester-only option"
          defaultChecked={property?.studyAbroadFriendly}
        />
        <Checkbox
          id="p-no-guarantor"
          name="noGuarantorOption"
          label="Accepts students without a US guarantor or SSN"
          defaultChecked={property?.noGuarantorOption}
        />
        <Checkbox id="p-grad" name="gradHeavy" label="Mostly graduate or professional students" defaultChecked={property?.gradHeavy} />
      </fieldset>

      <div>
        <Button type="submit" loading={pending}>
          {property ? 'Save property' : 'Create property'}
        </Button>
      </div>
    </form>
  );
}
