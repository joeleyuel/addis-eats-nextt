import Spinner from "@/components/Spinner";

// Shown while /menu or /menu/[id] is rendering on demand (e.g. an ISR
// regeneration or a dish that was not prerendered). The header is already there.
export default function MenuLoading() {
  return (
    <div className="container section">
      <Spinner label="Loading the menu…" />
    </div>
  );
}
