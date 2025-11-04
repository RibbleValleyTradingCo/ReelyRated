import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
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
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Catch Basics</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="image">Main Photo *</Label>
                  <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" className="max-h-48 mx-auto rounded" />
                    ) : (
                      <div className="space-y-2">
                        <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Upload your catch photo</p>
                      </div>
                    )}
                    <Input
                      id="image"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="mt-4"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        title: capitalizeFirstWord(e.target.value),
                      })
                    }
                    placeholder="e.g., Beautiful 20lb Mirror Carp"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="species">Species *</Label>
                  <Popover
                    open={speciesPopoverOpen}
                    onOpenChange={(isOpen) => {
                      setSpeciesPopoverOpen(isOpen);
                      if (!isOpen) {
                        setSpeciesSearch("");
                      }
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={speciesPopoverOpen}
                        className="w-full justify-between"
                      >
                        {(() => {
                          const selectedSpecies = UK_FRESHWATER_SPECIES.find((item) => item.value === formData.species);
                          if (selectedSpecies) return selectedSpecies.label;
                          if (formData.customSpecies) return formData.customSpecies;
                          return "Select species";
                        })()}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0">
                      <Command>
                        <CommandInput
                          placeholder="Search species…"
                          value={speciesSearch}
                          onValueChange={setSpeciesSearch}
                        />
                        <CommandList>
                          <CommandEmpty>
                            {trimmedSpeciesSearch
                              ? `No species found for "${trimmedSpeciesSearch}"`
                              : "Start typing to search species"}
                          </CommandEmpty>
                          <CommandGroup>
                            {trimmedSpeciesSearch && !hasExactSpeciesMatch && (
                              <CommandItem
                                value={`custom-${trimmedSpeciesSearch.toLowerCase()}`}
                                onSelect={() => {
                                  const customValue = toTitleCase(trimmedSpeciesSearch);
                                  setFormData((prev) => ({
                                    ...prev,
                                    species: "other",
                                    customSpecies: customValue,
                                  }));
                                  setSpeciesSearch("");
                                  setSpeciesPopoverOpen(false);
                                }}
                              >
                                Use "{toTitleCase(trimmedSpeciesSearch)}"
                              </CommandItem>
                            )}
                            {(formData.species || formData.customSpecies) && (
                              <CommandItem
                                value="clear-selection"
                                onSelect={() => {
                                  setFormData((prev) => ({
                                    ...prev,
                                    species: "",
                                    customSpecies: "",
                                  }));
                                  setSpeciesSearch("");
                                  setSpeciesPopoverOpen(false);
                                }}
                              >
                                Clear selection
                              </CommandItem>
                            )}
                            {UK_FRESHWATER_SPECIES.filter((species) => species.value !== "other").map((species) => (
                              <CommandItem
                                key={species.value}
                                value={species.label.toLowerCase()}
                                onSelect={() => {
                                  setFormData((prev) => ({
                                    ...prev,
                                    species: species.value,
                                    customSpecies: "",
                                  }));
                                  setSpeciesSearch("");
                                  setSpeciesPopoverOpen(false);
                                }}
                              >
                                {species.label}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="weight">Weight</Label>
                    <Input
                      id="weight"
                      type="number"
                      step="0.01"
                      value={formData.weight}
                      onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                      placeholder="e.g., 20.5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weightUnit">Unit</Label>
                    <Select value={formData.weightUnit} onValueChange={(value) => setFormData({ ...formData, weightUnit: value })}>
                      <SelectTrigger id="weightUnit">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lb_oz">lb/oz</SelectItem>
                        <SelectItem value="kg">kg</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="length">Length (optional)</Label>
                    <Input
                      id="length"
                      type="number"
                      step="0.1"
                      value={formData.length}
                      onChange={(e) => setFormData({ ...formData, length: e.target.value })}
                      placeholder="e.g., 65"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lengthUnit">Unit</Label>
                    <Select value={formData.lengthUnit} onValueChange={(value) => setFormData({ ...formData, lengthUnit: value })}>
                      <SelectTrigger id="lengthUnit">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cm">cm</SelectItem>
                        <SelectItem value="in">in</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Section 2: Location & Session */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Location & Session</h3>
                
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="location">Fishery / Venue *</Label>
                    <Popover open={open} onOpenChange={setOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={open}
                          className="w-full justify-between"
                          disabled={useGpsLocation}
                        >
                          {formData.location || "Select fishery..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0">
                        <Command>
                          <CommandInput placeholder="Search UK fisheries..." />
                          <CommandList>
                            <CommandEmpty>No fishery found.</CommandEmpty>
                            <CommandGroup>
                              {UK_FISHERIES.map((fishery) => (
                                <CommandItem
                                  key={fishery}
                                  value={fishery}
                                  onSelect={(currentValue) => {
                                    const normalized = normalizeVenueName(currentValue);
                                    setFormData((prev) => ({
                                      ...prev,
                                      location: normalized === prev.location ? "" : normalized,
                                      customLocationLabel: "",
                                    }));
                                    setUseGpsLocation(false);
                                    setGpsCoordinates(null);
                                    setGpsAccuracy(null);
                                    setOpen(false);
                                  }}
                                >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        formData.location === normalizeVenueName(fishery) ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {fishery}
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant={useGpsLocation ? "ocean" : "outline"}
                      disabled={isLocating && !useGpsLocation}
                      onClick={() => {
                        if (useGpsLocation) {
                          setUseGpsLocation(false);
                          setGpsCoordinates(null);
                          setGpsAccuracy(null);
                          setFormData((prev) => ({
                            ...prev,
                            customLocationLabel: "",
                          }));
                          setLocationError(null);
                          return;
                        }
                        void handleUseGps();
                      }}
                    >
                      {isLocating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
                      {useGpsLocation ? "Clear GPS Pin" : "Use Current GPS"}
                    </Button>
                    {!useGpsLocation && (
                      <span className="text-xs text-muted-foreground">
                        Prefer to pick from the list? No problem—GPS is optional.
                      </span>
                    )}
                  </div>
                  {locationError && <p className="text-sm text-destructive">{locationError}</p>}
                  {gpsCoordinates && (
                    <div className="space-y-3">
                      <div className="rounded-lg overflow-hidden border">
                        <iframe
                          title="Pinned fishing location"
                          src={`https://www.google.com/maps?q=${gpsCoordinates.lat},${gpsCoordinates.lng}&z=15&output=embed`}
                          width="100%"
                          height="250"
                          loading="lazy"
                          allowFullScreen
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Dropped pin at {gpsCoordinates.lat.toFixed(5)}, {gpsCoordinates.lng.toFixed(5)}
                        {gpsAccuracy ? ` (±${Math.round(gpsAccuracy)}m)` : ""}
                      </p>
                      <div className="space-y-1">
                        <Label htmlFor="customLocationLabel" className="text-xs text-muted-foreground">
                          Optional label for this spot
                        </Label>
                        <Input
                          id="customLocationLabel"
                          value={formData.customLocationLabel}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              customLocationLabel: capitalizeFirstWord(e.target.value),
                            }))
                          }
                          placeholder="e.g., Upper lake margins"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pegOrSwim">Peg / Swim (optional)</Label>
                  <Input
                    id="pegOrSwim"
                    value={formData.pegOrSwim}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pegOrSwim: capitalizeFirstWord(e.target.value),
                      })
                    }
                    placeholder="e.g., Peg 14"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="caughtAt">Date Caught</Label>
                    <Input
                      id="caughtAt"
                      type="date"
                      value={formData.caughtAt}
                      onChange={(e) => setFormData({ ...formData, caughtAt: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timeOfDay">Time of Day</Label>
                    <Select value={formData.timeOfDay} onValueChange={(value) => setFormData({ ...formData, timeOfDay: value })}>
                      <SelectTrigger id="timeOfDay">
                        <SelectValue placeholder="Select time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="morning">Morning</SelectItem>
                        <SelectItem value="afternoon">Afternoon</SelectItem>
                        <SelectItem value="evening">Evening</SelectItem>
                        <SelectItem value="night">Night</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="waterType">Water Type</Label>
                  <Popover
                    open={waterTypePopoverOpen}
                    onOpenChange={(isOpen) => {
                      setWaterTypePopoverOpen(isOpen);
                      if (!isOpen) {
                        setWaterTypeSearch("");
                      }
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={waterTypePopoverOpen}
                        className="w-full justify-between"
                      >
                        {(() => {
                          if (isLoadingWaterTypes) return "Loading water types…";
                          if (formData.waterType) {
                            const selected = waterTypeOptions.find((option) => option.code === formData.waterType);
                            if (selected) return selected.label;
                            return toTitleCase(formData.waterType.replace(/[-_]/g, " "));
                          }
                          return "Select water type";
                        })()}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0">
                      <Command>
                        <CommandInput
                          placeholder="Search water types…"
                          value={waterTypeSearch}
                          onValueChange={setWaterTypeSearch}
                        />
                        <CommandList>
                          <CommandEmpty>
                            {isLoadingWaterTypes
                              ? "Loading water types…"
                              : trimmedWaterTypeSearch
                                ? `No water types found for "${waterTypeSearch}"`
                                : "Start typing to search water types"}
                          </CommandEmpty>
                          {formData.waterType ? (
                            <CommandGroup heading="Quick actions">
                              <CommandItem
                                value="clear-water-type"
                                onSelect={() => {
                                  setFormData((prev) => ({
                                    ...prev,
                                    waterType: "",
                                  }));
                                  setWaterTypeSearch("");
                                  setWaterTypePopoverOpen(false);
                                }}
                              >
                                Clear selection
                              </CommandItem>
                            </CommandGroup>
                          ) : null}
                          {Object.entries(waterTypesByGroup).map(([groupLabel, items]) => (
                            <CommandGroup key={groupLabel} heading={groupLabel}>
                              {items.map((option) => (
                                <CommandItem
                                  key={option.code}
                                  value={option.code}
                                  onSelect={() => {
                                    setFormData((prev) => ({
                                      ...prev,
                                      waterType: option.code,
                                    }));
                                    setWaterTypeSearch("");
                                    setWaterTypePopoverOpen(false);
                                  }}
                                >
                                  {option.label}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          ))}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="session">Fishing Session</Label>
                  <Select
                    value={isCreatingSession ? CREATE_SESSION_OPTION : (selectedSessionId || NO_SESSION_OPTION)}
                    onValueChange={(value) => {
                      if (value === CREATE_SESSION_OPTION) {
                        setIsCreatingSession(true);
                        setSelectedSessionId("");
                      } else if (value === NO_SESSION_OPTION) {
                        setSelectedSessionId("");
                        setIsCreatingSession(false);
                      } else {
                        setSelectedSessionId(value);
                        setIsCreatingSession(false);
                      }
                    }}
                  >
                    <SelectTrigger id="session">
                      <SelectValue placeholder={isLoadingSessions ? "Loading sessions…" : "Select session"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_SESSION_OPTION}>No session</SelectItem>
                      {sessions.map((session) => (
                        <SelectItem key={session.id} value={session.id}>
                          {session.title}
                          {session.date ? ` • ${new Date(session.date).toLocaleDateString("en-GB")}` : ""}
                        </SelectItem>
                      ))}
                      <SelectItem value={CREATE_SESSION_OPTION}>Create new session</SelectItem>
                    </SelectContent>
                  </Select>
                  {selectedSessionId && !isCreatingSession && (
                    <p className="text-xs text-muted-foreground">
                      Selected session will group this catch with your other logs from that outing.
                    </p>
                  )}
                  {isCreatingSession && (
                    <div className="space-y-3 rounded-md border border-dashed border-border/60 bg-muted/20 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Create a new session</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => {
                            setIsCreatingSession(false);
                            setNewSession({ title: "", venue: "", date: new Date().toISOString().split("T")[0], notes: "" });
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="session-title">Session title *</Label>
                        <Input
                          id="session-title"
                          value={newSession.title}
                          onChange={(event) => setNewSession((prev) => ({ ...prev, title: event.target.value }))}
                          placeholder="Dawn patrol at Willow Lake"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="session-venue">Venue</Label>
                          <Input
                            id="session-venue"
                            value={newSession.venue}
                            onChange={(event) => setNewSession((prev) => ({ ...prev, venue: event.target.value }))}
                            placeholder="Willow Lake"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="session-date">Date</Label>
                          <Input
                            id="session-date"
                            type="date"
                            value={newSession.date}
                            onChange={(event) => setNewSession((prev) => ({ ...prev, date: event.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="session-notes">Notes</Label>
                        <Textarea
                          id="session-notes"
                          value={newSession.notes}
                          onChange={(event) => setNewSession((prev) => ({ ...prev, notes: event.target.value }))}
                          placeholder="Conditions, tactics, who you fished with…"
                          rows={3}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3: Tactics */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Tactics</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="baitUsed">Bait Used</Label>
                  <Popover
                    open={baitPopoverOpen}
                    onOpenChange={(isOpen) => {
                      setBaitPopoverOpen(isOpen);
                      if (!isOpen) {
                        setBaitSearch("");
                      }
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={baitPopoverOpen}
                        className="w-full justify-between"
                      >
                        {(() => {
                          if (isLoadingBaits) return "Loading baits…";
                          if (formData.baitUsed) return formData.baitUsed;
                          return "Select bait";
                        })()}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0">
                      <Command>
                        <CommandInput
                          placeholder="Search baits…"
                          value={baitSearch}
                          onValueChange={setBaitSearch}
                        />
                        <CommandList>
                          <CommandEmpty>
                            {isLoadingBaits
                              ? "Loading baits…"
                              : trimmedBaitSearch
                                ? `No baits found for "${baitSearch}"`
                                : "Start typing to search baits"}
                          </CommandEmpty>
                          <CommandGroup heading="Quick actions">
                            {trimmedBaitSearch && (
                              <CommandItem
                                value={`custom-bait-${trimmedBaitSearch}`}
                                onSelect={() => {
                                  const customValue = toTitleCase(baitSearch.trim());
                                  if (!customValue) return;
                                  setFormData((prev) => ({
                                    ...prev,
                                    baitUsed: customValue,
                                  }));
                                  setBaitSearch("");
                                  setBaitPopoverOpen(false);
                                }}
                              >
                                Use "{toTitleCase(baitSearch.trim())}"
                              </CommandItem>
                            )}
                            {formData.baitUsed && (
                              <CommandItem
                                value="clear-bait-selection"
                                onSelect={() => {
                                  setFormData((prev) => ({
                                    ...prev,
                                    baitUsed: "",
                                  }));
                                  setBaitSearch("");
                                  setBaitPopoverOpen(false);
                                }}
                              >
                                Clear selection
                              </CommandItem>
                            )}
                          </CommandGroup>
                          {Object.entries(baitsByCategory).map(([category, items]) => (
                            <CommandGroup key={category} heading={category}>
                              {items.map((bait) => (
                                <CommandItem
                                  key={bait.slug}
                                  value={bait.slug}
                                  onSelect={() => {
                                    setFormData((prev) => ({
                                      ...prev,
                                      baitUsed: bait.label,
                                    }));
                                    setBaitSearch("");
                                    setBaitPopoverOpen(false);
                                  }}
                                >
                                  {bait.label}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          ))}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="method">Method</Label>
                  <Popover
                    open={methodPopoverOpen}
                    onOpenChange={(isOpen) => {
                      setMethodPopoverOpen(isOpen);
                      if (!isOpen) {
                        setMethodSearch("");
                      }
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={methodPopoverOpen}
                        className="w-full justify-between"
                      >
                        {(() => {
                          if (isLoadingMethods) return "Loading methods…";
                          if (formData.method === "other") {
                            return formData.customMethod || "Other";
                          }
                          if (formData.method) {
                            const selected = methodOptions.find((item) => item.slug === formData.method);
                            if (selected) return selected.label;
                            return toTitleCase(formData.method.replace(/[-_]/g, " "));
                          }
                          return "Select method";
                        })()}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0">
                      <Command>
                        <CommandInput
                          placeholder="Search methods…"
                          value={methodSearch}
                          onValueChange={setMethodSearch}
                        />
                        <CommandList>
                          <CommandEmpty>
                            {isLoadingMethods
                              ? "Loading methods…"
                              : trimmedMethodSearch
                                ? `No methods found for "${methodSearch}"`
                                : "Start typing to search methods"}
                          </CommandEmpty>
                          <CommandGroup heading="Quick actions">
                            {trimmedMethodSearch && (
                              <CommandItem
                                value={`custom-${trimmedMethodSearch}`}
                                onSelect={() => {
                                  const customValue = toTitleCase(methodSearch.trim());
                                  setFormData((prev) => ({
                                    ...prev,
                                    method: "other",
                                    customMethod: customValue,
                                  }));
                                  setMethodSearch("");
                                  setMethodPopoverOpen(false);
                                }}
                              >
                                Use "{toTitleCase(methodSearch.trim())}"
                              </CommandItem>
                            )}
                            {formData.method || formData.customMethod ? (
                              <CommandItem
                                value="clear-method-selection"
                                onSelect={() => {
                                  setFormData((prev) => ({
                                    ...prev,
                                    method: "",
                                    customMethod: "",
                                  }));
                                  setMethodSearch("");
                                  setMethodPopoverOpen(false);
                                }}
                              >
                                Clear selection
                              </CommandItem>
                            ) : null}
                            <CommandItem
                              value="select-other-method"
                              onSelect={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  method: "other",
                                  customMethod: prev.customMethod,
                                }));
                                setMethodPopoverOpen(false);
                                setMethodSearch("");
                              }}
                            >
                              Other (describe manually)
                            </CommandItem>
                          </CommandGroup>
                          {Object.entries(methodsByGroup).map(([groupLabel, items]) => (
                            <CommandGroup key={groupLabel} heading={groupLabel}>
                              {items.map((method) => (
                                <CommandItem
                                  key={method.slug}
                                  value={method.slug}
                                  onSelect={() => {
                                    setFormData((prev) => ({
                                      ...prev,
                                      method: method.slug,
                                      customMethod: "",
                                    }));
                                    setMethodSearch("");
                                    setMethodPopoverOpen(false);
                                  }}
                                >
                                  {method.label}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          ))}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {formData.method === "other" && (
                    <div className="space-y-1">
                      <Label htmlFor="customMethod" className="text-xs text-muted-foreground">
                        Describe the method
                      </Label>
                      <Input
                        id="customMethod"
                        value={formData.customMethod}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            customMethod: capitalizeFirstWord(e.target.value),
                          }))
                        }
                        placeholder="e.g., Zigs"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="equipmentUsed">Equipment</Label>
                  <Input
                    id="equipmentUsed"
                    value={formData.equipmentUsed}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        equipmentUsed: capitalizeFirstWord(e.target.value),
                      })
                    }
                    placeholder="e.g., 12ft carp rod, baitrunner reel"
                  />
                </div>
              </div>

              {/* Section 4: Story */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Your Story</h3>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        description: capitalizeFirstWord(e.target.value),
                      })
                    }
                    placeholder="Tell the story of this catch... What happened? What was special about it?"
                    rows={5}
                  />
                </div>
              </div>

              {/* Section 5: Conditions (Collapsible) */}
              <Collapsible open={showConditions} onOpenChange={setShowConditions}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full flex justify-between" type="button">
                    <span>Conditions (optional)</span>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", showConditions && "rotate-180")} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="weather">Weather</Label>
                      <Select value={formData.weather} onValueChange={(value) => setFormData({ ...formData, weather: value })}>
                        <SelectTrigger id="weather">
                          <SelectValue placeholder="Select weather" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sunny">Sunny</SelectItem>
                          <SelectItem value="overcast">Overcast</SelectItem>
                          <SelectItem value="raining">Raining</SelectItem>
                          <SelectItem value="windy">Windy</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="airTemp">Air Temp (°C)</Label>
                      <Input
                        id="airTemp"
                        type="number"
                        value={formData.airTemp}
                        onChange={(e) => setFormData({ ...formData, airTemp: e.target.value })}
                        placeholder="e.g., 18"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="waterClarity">Water Clarity</Label>
                      <Select value={formData.waterClarity} onValueChange={(value) => setFormData({ ...formData, waterClarity: value })}>
                        <SelectTrigger id="waterClarity">
                          <SelectValue placeholder="Select clarity" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="clear">Clear</SelectItem>
                          <SelectItem value="coloured">Coloured</SelectItem>
                          <SelectItem value="unknown">Unknown</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="windDirection">Wind Direction</Label>
                      <Input
                        id="windDirection"
                        value={formData.windDirection}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            windDirection: capitalizeFirstWord(e.target.value),
                          })
                        }
                        placeholder="e.g., SW"
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Section 6: Media */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Additional Media</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="gallery">Gallery Photos (up to 6)</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {galleryPreviews.map((preview, index) => (
                      <div key={index} className="relative">
                        <img src={preview} alt={`Gallery ${index + 1}`} className="w-full h-24 object-cover rounded" />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6"
                          onClick={() => removeGalleryImage(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {galleryFiles.length < 6 && (
                      <label className="border-2 border-dashed rounded flex items-center justify-center h-24 cursor-pointer hover:bg-accent">
                        <Plus className="h-6 w-6 text-muted-foreground" />
                        <Input
                          id="gallery"
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleGalleryChange}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="videoUrl">Video URL (optional)</Label>
                  <Input
                    id="videoUrl"
                    value={formData.videoUrl}
                    onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                    placeholder="e.g., YouTube or Vimeo link"
                  />
                </div>
              </div>

              {/* Section 7: Tags & Privacy */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Tags & Privacy</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Input
                    id="tags"
                    value={formData.tags}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        tags: capitalizeFirstWord(e.target.value),
                      })
                    }
                    placeholder="e.g., #carp, #summer, #pb"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="visibility">Visibility</Label>
                  <Select value={formData.visibility} onValueChange={(value) => setFormData({ ...formData, visibility: value })}>
                    <SelectTrigger id="visibility">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="followers">Followers Only</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="hideExactSpot">Hide exact peg/swim</Label>
                    <p className="text-sm text-muted-foreground">Keep your fishing spot private</p>
                  </div>
                  <Switch
                    id="hideExactSpot"
                    checked={formData.hideExactSpot}
                    onCheckedChange={(checked) => setFormData({ ...formData, hideExactSpot: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="allowRatings">Allow community ratings</Label>
                    <p className="text-sm text-muted-foreground">Let others rate your catch</p>
                  </div>
                  <Switch
                    id="allowRatings"
                    checked={formData.allowRatings}
                    onCheckedChange={(checked) => setFormData({ ...formData, allowRatings: checked })}
                  />
                </div>
              </div>

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
