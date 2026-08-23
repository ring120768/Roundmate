// Grey placeholder shapes shown while a page's data loads. Server components
// mean a tap can otherwise sit on the OLD screen for a second or two on van
// 4G, which reads as "did that even work?".

export function SkelLine({ w = "100%", h = 14, mt = 10 }) {
  return <div className="skel" style={{ width: w, height: h, marginTop: mt }} />;
}

export function SkelRows({ count = 4 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card" style={{ marginBottom: 10 }}>
          <SkelLine w="55%" h={16} mt={0} />
          <SkelLine w="75%" h={12} />
        </div>
      ))}
    </>
  );
}

export default function PageSkeleton({ title = "Loading…", stats = false, rows = 4 }) {
  return (
    <div className="container" aria-busy="true" aria-live="polite">
      <h1>{title}</h1>
      <SkelLine w="60%" h={12} mt={6} />
      <div className="spacer" />
      {stats && (
        <>
          <div className="card">
            <div className="row">
              <div style={{ flex: 1 }}>
                <SkelLine w="60%" h={12} mt={0} />
                <SkelLine w="45%" h={30} />
              </div>
              <div style={{ flex: 1 }}>
                <SkelLine w="60%" h={12} mt={0} />
                <SkelLine w="45%" h={30} />
              </div>
            </div>
          </div>
          <div className="spacer" />
        </>
      )}
      <SkelRows count={rows} />
    </div>
  );
}
