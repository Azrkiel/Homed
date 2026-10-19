// Detail-page sections: a titled card, label/value rows, and the cost, commute and lease blocks.
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { CostDTO, ListingDetailDTO, WalkTimeDTO } from '../../api-types';
import { dateLabel, minutesLabel, money, perMonth, termLabel, yesNo } from '../../format';
import { radius, spacing, type, useTheme } from '../../theme';

export function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.heading, { color: colors.text }]} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

export function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={[styles.row, { borderTopColor: colors.border }]}
    >
      <Text style={[styles.rowLabel, { color: strong ? colors.text : colors.muted }, strong && styles.strong]}>
        {label}
      </Text>
      <Text style={[styles.rowValue, { color: colors.text }, strong && styles.strong]}>{value}</Text>
    </View>
  );
}

export function CostSection({ cost }: { cost: CostDTO }) {
  const { colors } = useTheme();
  return (
    <Section title="All-in cost per person">
      <Row label="Rent" value={perMonth(cost.rent)} />
      <Row label="Utilities" value={perMonth(cost.utilities)} />
      <Row label="Internet" value={perMonth(cost.internet)} />
      <Row label="Parking" value={perMonth(cost.parking)} />
      <Row label="Furniture" value={perMonth(cost.furniture)} />
      <Row label="All-in per month" value={perMonth(cost.totalMonthly)} strong />
      <Row label={`Lease total (${cost.leaseMonths} months)`} value={money(cost.totalLease)} />
      {cost.note ? <Text style={[styles.note, { color: colors.muted }]}>{cost.note}</Text> : null}
    </Section>
  );
}

export function CommuteSection({
  commute,
  walkTimes,
}: {
  commute: ListingDetailDTO['commute'];
  walkTimes: WalkTimeDTO[];
}) {
  const { colors } = useTheme();
  return (
    <Section title="Commute to your classes">
      <Row label="Average trip" value={minutesLabel(commute.averageMinutes)} />
      <Row
        label="Earliest class"
        value={commute.earliestClassMinutes === null ? 'No classes set' : minutesLabel(commute.earliestClassMinutes)}
      />
      <Row label="Total per week" value={minutesLabel(commute.weeklyMinutes)} />
      <Row label="Bus faster for some trips" value={yesNo(commute.usesBus)} />
      <Text style={[styles.subheading, { color: colors.text }]}>Walk times</Text>
      {walkTimes.length === 0 ? (
        <Text style={[styles.note, { color: colors.muted }]}>Add your classes to see walk times.</Text>
      ) : (
        walkTimes.map((w) => (
          <Row
            key={`${w.kind}-${w.name}`}
            label={w.name}
            value={
              w.busMinutes === null
                ? `${minutesLabel(w.walkMinutes)} walk`
                : `${minutesLabel(w.walkMinutes)} walk · bus ${minutesLabel(w.busMinutes)}`
            }
          />
        ))
      )}
    </Section>
  );
}

export function LeaseSection({ listing }: { listing: ListingDetailDTO }) {
  return (
    <Section title="Lease and unit">
      <Row label="Lease" value={`${dateLabel(listing.leaseStart)} to ${dateLabel(listing.leaseEnd)}`} />
      <Row label="Term" value={termLabel(listing.termKind)} />
      <Row label="Bedrooms / bathrooms" value={`${listing.beds} bd / ${listing.baths} ba`} />
      {listing.sqft !== undefined ? <Row label="Size" value={`${listing.sqft} sq ft`} /> : null}
      <Row label="Furnished" value={yesNo(listing.furnished)} />
      <Row label="Utilities included" value={yesNo(listing.utilitiesIncluded)} />
    </Section>
  );
}

export function AmenitiesSection({ amenities }: { amenities: string[] }) {
  const { colors } = useTheme();
  return (
    <Section title="Amenities">
      {amenities.length === 0 ? (
        <Text style={[styles.note, { color: colors.muted }]}>None listed.</Text>
      ) : (
        <Text style={[styles.rowValue, { color: colors.text }]}>{amenities.join(' · ')}</Text>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  section: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: spacing.lg, gap: spacing.sm },
  heading: { fontSize: type.heading, fontWeight: '700' },
  subheading: { fontSize: type.body, fontWeight: '700', marginTop: spacing.sm },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 36,
    paddingVertical: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { flex: 1, fontSize: type.body },
  rowValue: { fontSize: type.body, textAlign: 'right', flexShrink: 1 },
  strong: { fontWeight: '700' },
  note: { fontSize: type.small },
});
