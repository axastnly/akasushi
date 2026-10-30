import Button from "./Button";
import { asset } from "@/lib/paths";

export default function Chrome() {
  return (
    <header className="chrome">
      <div className="chrome__container">
        <a className="brand" href="#scene-00" aria-label="AKA Restaurant & Lounge, home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="brand__logo"
            src={asset("/assets/brand/aka-logo.svg")}
            alt="AKA Restaurant & Lounge"
            width={107}
            height={60}
          />
        </a>

        <Button href="#reserve" variant="primary" aria-label="Reserve your night at AKA">
          Reserve
        </Button>
      </div>
    </header>
  );
}
