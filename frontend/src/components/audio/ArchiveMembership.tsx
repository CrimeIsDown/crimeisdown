import { useEffect, useState } from "react";
import { legacyApi } from "@/lib/legacy-api";
export default function ArchiveMembership() {
  const [limit, setLimit] = useState<number>();
  useEffect(() => {
    void legacyApi<{
      patreon_tier?: { features?: { archive_downloads?: number } };
    }>("/api/user")
      .then((user) =>
        setLimit(user.patreon_tier?.features?.archive_downloads ?? 5),
      )
      .catch(() => {});
  }, []);
  return (
    <p>
      {limit === undefined ? (
        <a
          href="https://www.patreon.com/bePatron?u=4805116"
          referrerPolicy="unsafe-url"
          className="ptrn-button"
        >
          <img src="/img/become-a-patron.png" alt="Become a Patron!" />
        </a>
      ) : (
        <>
          You are logged in! You have{" "}
          {limit >= 1000
            ? "unlimited downloads"
            : `a download limit of ${limit}`}
          .
        </>
      )}
    </p>
  );
}
