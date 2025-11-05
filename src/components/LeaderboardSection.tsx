import { memo } from "react";
import { Link } from "react-router-dom";

import "./LeaderboardSection.css";

import { Leaderboard } from "@/components/Leaderboard";
import { Button } from "@/components/ui/button";

const LeaderboardSectionComponent = () => (
  <section className="leaderboard-section">
    <div className="leaderboard-section__container">
      <header className="leaderboard-section__header">
        <h2>Angler Leaderboard</h2>
        <p>
          Scores blend catch weight, community ratings, media evidence, and logbook completeness. Discover
          the most complete stories from the water.
        </p>
      </header>

      <Leaderboard />

      <div className="leaderboard-section__footer">
        <Button variant="ocean" asChild>
          <Link to="/leaderboard">View Full Leaderboard →</Link>
        </Button>
      </div>
    </div>
  </section>
);

export const LeaderboardSection = memo(LeaderboardSectionComponent);

LeaderboardSection.displayName = "LeaderboardSection";

export default LeaderboardSection;
