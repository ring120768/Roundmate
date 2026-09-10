// Two taps you actually want when you're stood outside the house: ring the
// customer, or point the phone's maps app at the door. Plain anchors, so this
// works in a server component with no JavaScript.
export default function ContactActions({ phone, address }) {
  if (!phone && !address) return null;

  const telHref = phone ? `tel:${String(phone).replace(/[^\d+]/g, "")}` : null;
  const mapHref = address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        address
      )}&travelmode=driving&dir_action=navigate`
    : null;

  return (
    <div className="actions-row">
      {telHref ? (
        <a className="btn secondary" href={telHref}>
          Call
        </a>
      ) : (
        <span className="btn secondary" aria-disabled="true">
          No phone
        </span>
      )}
      {mapHref ? (
        <a
          className="btn secondary"
          href={mapHref}
          target="_blank"
          rel="noreferrer"
        >
          Navigate
        </a>
      ) : (
        <span className="btn secondary" aria-disabled="true">
          No address
        </span>
      )}
    </div>
  );
}
