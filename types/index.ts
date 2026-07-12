export interface Agency {
  id: string;
  name: string;
  socialLinks?: {
    youtube?: string;
    x?: string;
    instagram?: string;
    weverse?: string;
    namuwiki?: string;
  };
  artistIds?: string[];
}

export interface Artist {
  id: string;                 
  agencyId?: string;
  name: {
    ko: string;               
    en: string;               
    aliases: string[];        
  };
  gender?: "male" | "female" | "mixed";
  generation: number;         
  type: "group" | "solo" | "unit";
  parentGroup?: string | null;
  parentGroupId?: string;
  parentGroupName?: string;
  members: { name: string; artistId?: string }[];          
  recentComebackId?: string;
  comebackIds?: string[];
  agency?: {
    id?: string;
    name: string;             
    parentName?: string;
    youtubeUrl?: string;      
  };
  socialLinks: {
    youtube?: string;         
    x?: string;               
    instagram?: string;       
    tiktok?: string;          
    weverse?: string;
    namuwiki?: string;
  };
  profileImageUrl?: string;   
  isActive: boolean;          
}

export type ReleaseType = "single" | "pre-release" | "ep" | "mini" | "full" | "repackage";

export interface ComebackTrack {
  title: string;               
  isTitle: boolean;            
  duration?: string;           
}

export interface StreamingLinks {
  melon?: string;
  spotify?: string;
  youtubeMusic?: string;
  genie?: string;
  bugs?: string;
}

export interface MediaLinks {
  musicVideo?: string;         
  teasers: string[];           
  highlightMedley?: string;    
}

export interface Track {
  id: string;
  comebackId: string;
  artistId: string;
  name: string;
  isTitle: boolean;
  duration?: string;
  musicVideoUrl?: string;
  streamingLinks?: {
    melon?: string;
    spotify?: string;
    appleMusic?: string;
    bugs?: string;
  };
  composers?: string[];
  lyricists?: string[];
  artistName?: string;
  albumTitle?: string;
}

export interface Comeback {
  id: string;
  artistId: string;
  artistName: string;
  artistGender?: "male" | "female" | "mixed";
  artistType: "group" | "solo" | "unit" | "unknown";
  parentGroupName?: string;
  parentGroupId?: string;
  agencyName: string;
  albumTitle: string; // Renamed from title to albumTitle
  titleTracks: {
    name: string;
    musicVideoUrl?: string;
  }[];
  releaseDate: string; // YYYY-MM-DD
  releaseType: string;
  isCompleted: boolean; // Has the comeback date passed?
  albumCoverUrl: string;
  streamingLinks: {
    bugs?: string; // Album level bugs link
  };
  mediaLinks?: MediaLinks;
  status?: "ANNOUNCED" | "TEASING" | "RELEASED";
  teasers?: string[]; // YouTube URLs
  isTba?: boolean;
}
