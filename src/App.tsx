import { useState } from "react";
import "./App.css";
import { GameRoot } from "./game/GameRoot";
import { LoadingScreen } from "./screens/LoadingScreen";
import { MainMenu } from "./screens/MainMenu";

type Screen = "loading" | "lobby" | "playing";

function App() {
  const [screen, setScreen] = useState<Screen>("loading");

  switch (screen) {
    case "loading":
      return <LoadingScreen onComplete={() => setScreen("lobby")} />;
    case "lobby":
      return <MainMenu onStartGame={() => setScreen("playing")} />;
    case "playing":
      return <GameRoot onReturnToLobby={() => setScreen("lobby")} />;
  }
}

export default App;
