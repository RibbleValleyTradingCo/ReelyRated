import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Compass } from "lucide-react";

const ProfileNotFound = () => (
  <div className="min-h-screen bg-slate-50">
    <Navbar />
    <main className="mx-auto flex max-w-3xl flex-col items-center justify-center px-4 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 text-sky-600">
        <Compass className="h-8 w-8" aria-hidden="true" />
      </div>
      <h1 className="mt-6 text-3xl font-semibold text-slate-900">Angler not found</h1>
      <p className="mt-3 text-base text-slate-600">
        We couldn&apos;t find the profile you were looking for. It might have been renamed or doesn&apos;t exist.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link to="/search">Open search</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/feed">Return to feed</Link>
        </Button>
      </div>
    </main>
  </div>
);

export default ProfileNotFound;
