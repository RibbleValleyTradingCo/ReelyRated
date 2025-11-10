import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Upload, Check, ChevronsUpDown, ChevronDown, Plus, X, Loader2, MapPin } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { UK_FISHERIES, UK_FRESHWATER_SPECIES, normalizeVenueName } from "@/lib/freshwater-data";
import type { Database } from "@/integrations/supabase/types";
import { CatchBasicsSection } from "@/components/catch-form/CatchBasicsSection";
import { LocationSessionSection } from "@/components/catch-form/LocationSessionSection";
import { TacticsSection } from "@/components/catch-form/TacticsSection";
import { StorySection } from "@/components/catch-form/StorySection";
import { ConditionsSection } from "@/components/catch-form/ConditionsSection";
import { MediaUploadSection } from "@/components/catch-form/MediaUploadSection";
import { TagsPrivacySection } from "@/components/catch-form/TagsPrivacySection";

const capitalizeFirstWord = (value: string) => {
  if (!value) return "";
  const trimmed = value.trimStart();
  if (!trimmed) return "";
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
};

const toTitleCase = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

const formatGroupLabel = (value: string | null | undefined) => {
  if (!value) return "Other";
  return toTitleCase(value.replace(/[-_]/g, " "));
};

type SessionOption = {
  id: string;
  title: string;
  venue: string | null;
  date: string | null;
};

const CREATE_SESSION_OPTION = "__create_session";
const NO_SESSION_OPTION = "__no_session";

const AddCatch = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [speciesPopoverOpen, setSpeciesPopoverOpen] = useState(false);
  const [speciesSearch, setSpeciesSearch] = useState("");
  const [showConditions, setShowConditions] = useState(false);
  const [methodOptions, setMethodOptions] = useState<{ slug: string; label: string; group: string }[]>([]);
  const [isLoadingMethods, setIsLoadingMethods] = useState(false);
  const [methodPopoverOpen, setMethodPopoverOpen] = useState(false);
  const [methodSearch, setMethodSearch] = useState("");
  const [baitOptions, setBaitOptions] = useState<{ slug: string; label: string; category: string }[]>([]);
  const [isLoadingBaits, setIsLoadingBaits] = useState(false);
  const [baitPopoverOpen, setBaitPopoverOpen] = useState(false);
  const [baitSearch, setBaitSearch] = useState("");
  const [waterTypeOptions, setWaterTypeOptions] = useState<{ code: string; label: string; group: string }[]>([]);
  const [isLoadingWaterTypes, setIsLoadingWaterTypes] = useState(false);
  const [waterTypePopoverOpen, setWaterTypePopoverOpen] = useState(false);
  const [waterTypeSearch, setWaterTypeSearch] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    species: "",
    customSpecies: "",
    weight: "",
    weightUnit: "lb_oz",
    length: "",
    lengthUnit: "cm",
    description: "",
    location: "",
    customLocationLabel: "",
    pegOrSwim: "",
    waterType: "",
    method: "",
    customMethod: "",
    baitUsed: "",
    equipmentUsed: "",
    caughtAt: new Date().toISOString().split('T')[0],
    timeOfDay: "",
    weather: "",
    airTemp: "",
    waterClarity: "",
    windDirection: "",
    tags: "",
    videoUrl: "",
    visibility: "public",
    hideExactSpot: false,
    allowRatings: true,
  });
  const [useGpsLocation, setUseGpsLocation] = useState(false);
  const [gpsCoordinates, setGpsCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [newSession, setNewSession] = useState({
    title: "",
    venue: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const trimmedMethodSearch = methodSearch.trim().toLowerCase();
  const filteredMethods = methodOptions.filter((method) => {
    if (!trimmedMethodSearch) return true;
    return (
      method.label.toLowerCase().includes(trimmedMethodSearch) ||
      method.slug.toLowerCase().includes(trimmedMethodSearch)
    );
  });

  const methodsByGroup = filteredMethods.reduce<Record<string, { slug: string; label: string }[]>>((acc, method) => {
    const key = method.group || "Other";
    if (!acc[key]) acc[key] = [];
    acc[key].push({ slug: method.slug, label: method.label });
    return acc;
  }, {});

  const trimmedBaitSearch = baitSearch.trim().toLowerCase();
  const filteredBaits = baitOptions.filter((bait) => {
    if (!trimmedBaitSearch) return true;
    return (
      bait.label.toLowerCase().includes(trimmedBaitSearch) ||
      bait.slug.toLowerCase().includes(trimmedBaitSearch)
    );
  });

  const baitsByCategory = filteredBaits.reduce<Record<string, { slug: string; label: string }[]>>((acc, bait) => {
    const key = formatGroupLabel(bait.category);
    if (!acc[key]) acc[key] = [];
    acc[key].push({ slug: bait.slug, label: bait.label });
    return acc;
  }, {});

  const trimmedWaterTypeSearch = waterTypeSearch.trim().toLowerCase();
  const filteredWaterTypes = waterTypeOptions.filter((option) => {
    if (!trimmedWaterTypeSearch) return true;
    return (
      option.label.toLowerCase().includes(trimmedWaterTypeSearch) ||
      option.code.toLowerCase().includes(trimmedWaterTypeSearch)
    );
  });

  const waterTypesByGroup = filteredWaterTypes.reduce<Record<string, { code: string; label: string }[]>>(
    (acc, option) => {
      const key = formatGroupLabel(option.group);
      if (!acc[key]) acc[key] = [];
      acc[key].push({ code: option.code, label: option.label });
      return acc;
    },
    {},
  );

  const trimmedSpeciesSearch = speciesSearch.trim();
  const hasExactSpeciesMatch =
    trimmedSpeciesSearch.length > 0 &&
    UK_FRESHWATER_SPECIES.some(
      (species) => species.label.toLowerCase() === trimmedSpeciesSearch.toLowerCase(),
    );

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    let isMounted = true;
    setIsLoadingMethods(true);

    supabase
      .from("tags")
      .select("slug,label,method_group")
      .eq("category", "method")
      .order("method_group", { ascending: true, nullsFirst: false })
      .order("label", { ascending: true })
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          console.error("Failed to load method tags", error);
          setMethodOptions([]);
        } else {
          setMethodOptions(
            (data ?? []).map((item) => ({
              slug: item.slug,
              label: item.label,
              group: item.method_group ?? "Other",
            }))
          );
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingMethods(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    setIsLoadingBaits(true);

    supabase
      .from("baits")
      .select("slug,label,category")
      .order("category", { ascending: true })
      .order("label", { ascending: true })
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          console.error("Failed to load baits", error);
          setBaitOptions([]);
        } else {
          setBaitOptions(
            (data ?? []).map((item) => ({
              slug: item.slug,
              label: item.label,
              category: item.category ?? "other",
            }))
          );
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingBaits(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    setIsLoadingWaterTypes(true);

    supabase
      .from("water_types")
      .select("code,label,group_name")
      .order("group_name", { ascending: true, nullsFirst: false })
      .order("label", { ascending: true })
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          console.error("Failed to load water types", error);
          setWaterTypeOptions([]);
        } else {
          setWaterTypeOptions(
            (data ?? []).map((item) => ({
              code: item.code,
              label: item.label,
              group: item.group_name ?? "other",
            }))
          );
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingWaterTypes(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const fetchSessions = async () => {
      if (!user) {
        setSessions([]);
        return;
      }
      setIsLoadingSessions(true);
      const { data, error } = await supabase
        .from("sessions")
        .select("id, title, venue, date")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(20);

      if (error) {
        console.error("Failed to load sessions", error);
        setSessions([]);
      } else if (data) {
        setSessions(data as SessionOption[]);
      }
      setIsLoadingSessions(false);
    };

    if (!loading) {
      void fetchSessions();
    }
  }, [loading, user]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (galleryFiles.length + files.length > 6) {
      toast.error("Maximum 6 gallery photos allowed");
      return;
    }
    
    setGalleryFiles([...galleryFiles, ...files]);
    
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setGalleryPreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeGalleryImage = (index: number) => {
    setGalleryFiles(galleryFiles.filter((_, i) => i !== index));
    setGalleryPreviews(galleryPreviews.filter((_, i) => i !== index));
  };

  const handleUseGps = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported on this device.");
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsCoordinates({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setGpsAccuracy(position.coords.accuracy ?? null);
        setUseGpsLocation(true);
        setIsLocating(false);
        setFormData((prev) => ({
          ...prev,
          location: "",
        }));
      },
      (error) => {
        setIsLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError("Location permission denied. Please enable it in your browser settings.");
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError("Unable to determine your location. Try again in an open area.");
            break;
          case error.TIMEOUT:
            setLocationError("Location request timed out. Please try again.");
            break;
          default:
            setLocationError("We couldn't get your location. Please try again.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFile || !user) return;

    if (!formData.species) {
      toast.error("Please select a species");
      return;
    }

    const speciesIsOther = formData.species === "other";
    if (speciesIsOther && !formData.customSpecies) {
      toast.error("Please describe the species when selecting Other");
      return;
    }

    const methodIsOther = formData.method === "other";
    if (methodIsOther && !formData.customMethod) {
      toast.error("Please describe the method when selecting Other");
      return;
    }

    const customLocationLabel = formData.customLocationLabel
      ? capitalizeFirstWord(formData.customLocationLabel)
      : "";
    const finalLocation =
      useGpsLocation && gpsCoordinates
        ? customLocationLabel || "Pinned location"
        : formData.location;

    if (!finalLocation) {
      toast.error("Please choose a fishery or drop a GPS pin");
      return;
    }

    const normalizedLocation = normalizeVenueName(finalLocation);

    setIsSubmitting(true);

    try {
      const selectedWaterTypeOption = formData.waterType
        ? waterTypeOptions.find((option) => option.code === formData.waterType)
        : undefined;
      const normalizedWaterType = formData.waterType ? formData.waterType : null;

      let sessionId: string | null = selectedSessionId || null;
      let createdSession: SessionOption | null = null;

      if (isCreatingSession) {
        if (!newSession.title.trim()) {
          toast.error("Session title is required");
          setIsSubmitting(false);
          return;
        }

        const sessionVenue = newSession.venue.trim()
          ? normalizeVenueName(newSession.venue)
          : normalizedLocation;

        const { data: sessionInsert, error: sessionError } = await supabase
          .from("sessions")
          .insert({
            user_id: user.id,
            title: newSession.title.trim(),
            venue: sessionVenue || null,
            date: newSession.date ? newSession.date : null,
            notes: newSession.notes.trim() || null,
          })
          .select("id, title, venue, date")
          .single();

        if (sessionError || !sessionInsert) {
          throw sessionError ?? new Error("Failed to create session");
        }

        sessionId = sessionInsert.id;
        createdSession = sessionInsert as SessionOption;
      }
      // Upload main image
      const fileExt = imageFile.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("catches")
        .upload(fileName, imageFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("catches")
        .getPublicUrl(fileName);

      // Upload gallery images
      const galleryUrls: string[] = [];
      for (const file of galleryFiles) {
        const ext = file.name.split(".").pop();
        const name = `${user.id}-${Date.now()}-${Math.random()}.${ext}`;
        const { error: galleryError } = await supabase.storage
          .from("catches")
          .upload(name, file);
        
        if (!galleryError) {
          const { data: { publicUrl: galleryUrl } } = supabase.storage
            .from("catches")
            .getPublicUrl(name);
          galleryUrls.push(galleryUrl);
        }
      }

      // Prepare conditions object
      const conditions: Record<string, unknown> = {};
      if (formData.weather) conditions.weather = formData.weather;
      if (formData.airTemp) conditions.airTemp = parseFloat(formData.airTemp);
      if (formData.waterClarity) conditions.waterClarity = formData.waterClarity;
      if (formData.windDirection) conditions.windDirection = formData.windDirection;

      const customFields: Record<string, string> = {};
      if (speciesIsOther && formData.customSpecies) {
        customFields.species = formData.customSpecies;
      }
      if (methodIsOther && formData.customMethod) {
        customFields.method = formData.customMethod;
      }
      if (formData.waterType) {
        const waterTypeLabel =
          selectedWaterTypeOption?.label ??
          toTitleCase(formData.waterType.replace(/[-_]/g, " "));
        if (waterTypeLabel) {
          customFields.waterType = waterTypeLabel;
        }
      }
      if (Object.keys(customFields).length > 0) {
        conditions.customFields = customFields;
      }

      if (useGpsLocation && gpsCoordinates) {
        conditions.gps = {
          lat: gpsCoordinates.lat,
          lng: gpsCoordinates.lng,
          ...(gpsAccuracy ? { accuracy: gpsAccuracy } : {}),
          ...(customLocationLabel ? { label: customLocationLabel } : {}),
        };
        conditions.locationSource = "gps";
      } else if (formData.location) {
        conditions.locationSource = "manual";
      }

      // Parse tags
      const tags = formData.tags
        ? formData.tags.split(',').map(t => t.trim()).filter(t => t)
        : [];

      const conditionsPayload =
        Object.keys(conditions).length > 0
          ? (conditions as Database["public"]["Tables"]["catches"]["Insert"]["conditions"])
          : null;

      // Insert catch record
      const catchData: Database["public"]["Tables"]["catches"]["Insert"] = {
        user_id: user.id,
        image_url: publicUrl,
        title: formData.title,
        description: formData.description || null,
        location: normalizedLocation || null,
        bait_used: formData.baitUsed || null,
        equipment_used: formData.equipmentUsed || null,
        caught_at: formData.caughtAt || null,
        species: formData.species || null,
        weight: formData.weight ? parseFloat(formData.weight) : null,
        weight_unit: formData.weightUnit as Database["public"]["Enums"]["weight_unit"],
        length: formData.length ? parseFloat(formData.length) : null,
        length_unit: formData.lengthUnit as Database["public"]["Enums"]["length_unit"],
        peg_or_swim: formData.pegOrSwim || null,
        water_type: normalizedWaterType,
        method: formData.method || null,
        time_of_day: formData.timeOfDay || null,
        conditions: conditionsPayload,
        tags,
        gallery_photos: galleryUrls,
        video_url: formData.videoUrl || null,
        visibility: formData.visibility as Database["public"]["Enums"]["visibility_type"],
        hide_exact_spot: formData.hideExactSpot,
        allow_ratings: formData.allowRatings,
        session_id: sessionId,
      };

      const { error: insertError } = await supabase.from("catches").insert(catchData);

      if (insertError) throw insertError;

      if (createdSession) {
        setSessions((prev) => [createdSession!, ...prev.filter((session) => session.id !== createdSession!.id)]);
        setSelectedSessionId(createdSession.id);
        setIsCreatingSession(false);
        setNewSession({ title: "", venue: "", date: new Date().toISOString().split("T")[0], notes: "" });
      }

      toast.success("Catch added successfully!");
      navigate("/feed");
    } catch (error) {
      console.error("Error adding catch:", error);
      const message =
        error && typeof error === "object" && "message" in error && typeof (error as { message?: unknown }).message === "string"
          ? (error as { message: string }).message
          : null;
      if (message?.toLowerCase().includes("bucket")) {
        toast.error("Unable to upload images. Please create a 'catches' storage bucket in Supabase.");
      } else {
        toast.error(message ?? "Failed to add catch. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted">
        <Navbar />
        <div className="container mx-auto px-4 py-8">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Log Your Catch</CardTitle>
            <p className="text-sm text-muted-foreground">Share your fishing success with the community</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Section 1: Catch Basics */}
              <CatchBasicsSection
                imageFile={imageFile}
                imagePreview={imagePreview}
                title={formData.title}
                species={formData.species}
                customSpecies={formData.customSpecies}
                weight={formData.weight}
                weightUnit={formData.weightUnit}
                length={formData.length}
                lengthUnit={formData.lengthUnit}
                speciesPopoverOpen={speciesPopoverOpen}
                speciesSearch={speciesSearch}
                onImageChange={handleImageChange}
                onTitleChange={(title) => setFormData((prev) => ({ ...prev, title }))}
                onSpeciesChange={(species, customSpecies) =>
                  setFormData((prev) => ({ ...prev, species, customSpecies }))
                }
                onWeightChange={(weight) => setFormData((prev) => ({ ...prev, weight }))}
                onWeightUnitChange={(weightUnit) =>
                  setFormData((prev) => ({ ...prev, weightUnit }))
                }
                onLengthChange={(length) => setFormData((prev) => ({ ...prev, length }))}
                onLengthUnitChange={(lengthUnit) =>
                  setFormData((prev) => ({ ...prev, lengthUnit }))
                }
                onSpeciesPopoverOpenChange={setSpeciesPopoverOpen}
                onSpeciesSearchChange={setSpeciesSearch}
              />

              {/* Section 2: Location & Session */}
              <LocationSessionSection
                location={formData.location}
                customLocationLabel={formData.customLocationLabel}
                pegOrSwim={formData.pegOrSwim}
                caughtAt={formData.caughtAt}
                timeOfDay={formData.timeOfDay}
                waterType={formData.waterType}
                open={open}
                useGpsLocation={useGpsLocation}
                isLocating={isLocating}
                locationError={locationError}
                gpsCoordinates={gpsCoordinates}
                gpsAccuracy={gpsAccuracy}
                waterTypePopoverOpen={waterTypePopoverOpen}
                waterTypeSearch={waterTypeSearch}
                isLoadingWaterTypes={isLoadingWaterTypes}
                waterTypeOptions={waterTypeOptions}
                waterTypesByGroup={waterTypesByGroup}
                trimmedWaterTypeSearch={trimmedWaterTypeSearch}
                selectedSessionId={selectedSessionId}
                isCreatingSession={isCreatingSession}
                isLoadingSessions={isLoadingSessions}
                sessions={sessions}
                newSession={newSession}
                CREATE_SESSION_OPTION={CREATE_SESSION_OPTION}
                NO_SESSION_OPTION={NO_SESSION_OPTION}
                onLocationChange={(location) =>
                  setFormData((prev) => ({ ...prev, location }))
                }
                onCustomLocationLabelChange={(customLocationLabel) =>
                  setFormData((prev) => ({ ...prev, customLocationLabel }))
                }
                onPegOrSwimChange={(pegOrSwim) =>
                  setFormData((prev) => ({ ...prev, pegOrSwim }))
                }
                onCaughtAtChange={(caughtAt) =>
                  setFormData((prev) => ({ ...prev, caughtAt }))
                }
                onTimeOfDayChange={(timeOfDay) =>
                  setFormData((prev) => ({ ...prev, timeOfDay }))
                }
                onWaterTypeChange={(waterType) =>
                  setFormData((prev) => ({ ...prev, waterType }))
                }
                onOpenChange={setOpen}
                onUseGpsLocationChange={(
                  useGps,
                  coords,
                  accuracy,
                  label,
                  error
                ) => {
                  setUseGpsLocation(useGps);
                  setGpsCoordinates(coords);
                  setGpsAccuracy(accuracy);
                  setFormData((prev) => ({ ...prev, customLocationLabel: label }));
                  setLocationError(error);
                }}
                onHandleUseGps={handleUseGps}
                onWaterTypePopoverOpenChange={setWaterTypePopoverOpen}
                onWaterTypeSearchChange={setWaterTypeSearch}
                onSelectedSessionIdChange={setSelectedSessionId}
                onIsCreatingSessionChange={setIsCreatingSession}
                onNewSessionChange={setNewSession}
              />

              {/* Section 3: Tactics */}
              <TacticsSection
                baitUsed={formData.baitUsed}
                method={formData.method}
                customMethod={formData.customMethod}
                equipmentUsed={formData.equipmentUsed}
                baitPopoverOpen={baitPopoverOpen}
                methodPopoverOpen={methodPopoverOpen}
                baitSearch={baitSearch}
                methodSearch={methodSearch}
                isLoadingBaits={isLoadingBaits}
                isLoadingMethods={isLoadingMethods}
                baitsByCategory={baitsByCategory}
                methodsByGroup={methodsByGroup}
                trimmedBaitSearch={trimmedBaitSearch}
                trimmedMethodSearch={trimmedMethodSearch}
                onBaitUsedChange={(baitUsed) =>
                  setFormData((prev) => ({ ...prev, baitUsed }))
                }
                onMethodChange={(method, customMethod) =>
                  setFormData((prev) => ({ ...prev, method, customMethod }))
                }
                onCustomMethodChange={(customMethod) =>
                  setFormData((prev) => ({ ...prev, customMethod }))
                }
                onEquipmentUsedChange={(equipmentUsed) =>
                  setFormData((prev) => ({ ...prev, equipmentUsed }))
                }
                onBaitPopoverOpenChange={setBaitPopoverOpen}
                onMethodPopoverOpenChange={setMethodPopoverOpen}
                onBaitSearchChange={setBaitSearch}
                onMethodSearchChange={setMethodSearch}
              />

              {/* Section 4: Story */}
              <StorySection
                description={formData.description}
                onDescriptionChange={(description) =>
                  setFormData((prev) => ({ ...prev, description }))
                }
              />

              {/* Section 5: Conditions (Collapsible) */}
              <ConditionsSection
                showConditions={showConditions}
                weather={formData.weather}
                airTemp={formData.airTemp}
                waterClarity={formData.waterClarity}
                windDirection={formData.windDirection}
                onShowConditionsChange={setShowConditions}
                onWeatherChange={(weather) => setFormData((prev) => ({ ...prev, weather }))}
                onAirTempChange={(airTemp) => setFormData((prev) => ({ ...prev, airTemp }))}
                onWaterClarityChange={(waterClarity) =>
                  setFormData((prev) => ({ ...prev, waterClarity }))
                }
                onWindDirectionChange={(windDirection) =>
                  setFormData((prev) => ({ ...prev, windDirection }))
                }
              />

              {/* Section 6: Media */}
              <MediaUploadSection
                galleryFiles={galleryFiles}
                galleryPreviews={galleryPreviews}
                videoUrl={formData.videoUrl}
                onGalleryChange={handleGalleryChange}
                onRemoveGalleryImage={removeGalleryImage}
                onVideoUrlChange={(videoUrl) =>
                  setFormData((prev) => ({ ...prev, videoUrl }))
                }
              />

              {/* Section 7: Tags & Privacy */}
              <TagsPrivacySection
                tags={formData.tags}
                visibility={formData.visibility}
                hideExactSpot={formData.hideExactSpot}
                allowRatings={formData.allowRatings}
                onTagsChange={(tags) => setFormData((prev) => ({ ...prev, tags }))}
                onVisibilityChange={(visibility) =>
                  setFormData((prev) => ({ ...prev, visibility }))
                }
                onHideExactSpotChange={(hideExactSpot) =>
                  setFormData((prev) => ({ ...prev, hideExactSpot }))
                }
                onAllowRatingsChange={(allowRatings) =>
                  setFormData((prev) => ({ ...prev, allowRatings }))
                }
              />

              <Button type="submit" className="w-full" size="lg" disabled={isSubmitting || !imageFile}>
                {isSubmitting ? "Publishing Catch..." : "Publish Catch"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AddCatch;
