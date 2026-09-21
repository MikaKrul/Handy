import React from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { useSettings } from "../../hooks/useSettings";

interface StopWithEnterProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const StopWithEnter: React.FC<StopWithEnterProps> = React.memo(
  ({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { getSetting, updateSetting, isUpdating } = useSettings();

    const enabled = getSetting("stop_with_enter") ?? true;

    return (
      <ToggleSwitch
        checked={enabled}
        onChange={(enabled) => updateSetting("stop_with_enter", enabled)}
        isUpdating={isUpdating("stop_with_enter")}
        label={t("settings.general.stopWithEnter.label")}
        description={t("settings.general.stopWithEnter.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      />
    );
  },
);
