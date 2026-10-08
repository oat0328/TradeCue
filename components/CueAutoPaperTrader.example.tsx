import React from "react";
import {Example,Screens} from "@floot/examples";
import {CueAutoPaperTrader} from "./CueAutoPaperTrader";
export default function Showcase(){
 return <><h1>Omega readable stock hunt</h1><p>The actual Omega screen with no connected paper account. Unconfirmed values stay visibly unconfirmed.</p>
 <Screens title="Omega"><Example title="Waiting for connection"><CueAutoPaperTrader enabled={false} buyingPower={0} maxRiskPerTrade={0}/></Example></Screens></>;
}
