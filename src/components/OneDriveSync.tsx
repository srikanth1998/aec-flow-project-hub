import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Cloud, CloudOff, RefreshCw, ExternalLink } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface OneDriveConnection {
  id: string;
  organization_id: string;
  folder_path: string | null;
  last_sync_at: string | null;
  sync_enabled: boolean;
  created_at: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  updated_at: string;
}

interface OneDriveFile {
  id: string;
  file_name: string;
  web_url: string;
  parsed_client_name: string | null;
  parsed_project_name: string | null;
  file_type: string | null;
  modified_at: string | null;
  sync_status: string | null;
  organization_id: string;
  project_id: string | null;
  onedrive_file_id: string;
  file_path: string;
  download_url: string | null;
  file_size: number | null;
  created_at: string;
  updated_at: string;
}

export function OneDriveSync() {
  const [connection, setConnection] = useState<OneDriveConnection | null>(null);
  const [files, setFiles] = useState<OneDriveFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    checkConnection();
    handleAuthCallback();
  }, []);

  useEffect(() => {
    if (connection) {
      loadFiles();
    }
  }, [connection]);

  const checkConnection = async () => {
    try {
      // Use raw query since the types haven't been updated yet
      const { data, error } = await supabase
        .from('onedrive_connections' as any)
        .select('*')
        .eq('sync_enabled', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking connection:', error);
        return;
      }

      setConnection(data as unknown as OneDriveConnection);
    } catch (error) {
      console.error('Error checking OneDrive connection:', error);
    }
  };

  const loadFiles = async () => {
    if (!connection) return;

    try {
      // Use raw query since the types haven't been updated yet
      const { data, error } = await supabase
        .from('onedrive_files' as any)
        .select('*')
        .eq('organization_id', connection.organization_id)
        .order('modified_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setFiles((data as unknown as OneDriveFile[]) || []);
    } catch (error) {
      console.error('Error loading files:', error);
      toast.error('Failed to load OneDrive files');
    }
  };

  const handleAuthCallback = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state'); // organization_id

    console.log('OneDrive callback check:', { code: !!code, state: !!state });

    if (code && state) {
      console.log('Processing OneDrive callback...');
      exchangeCodeForToken(code, state);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  const connectToOneDrive = async () => {
    setIsLoading(true);
    try {
      console.log('🔄 Starting OneDrive connection...');
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .single();

      if (!profile?.organization_id) {
        throw new Error('No organization found. Please ensure your profile is set up correctly.');
      }

      console.log('✅ Profile found, organization ID:', profile.organization_id);

      const { data, error } = await supabase.functions.invoke('onedrive-sync', {
        body: {
          action: 'get_auth_url',
          organizationId: profile.organization_id,
        },
      });

      if (error) {
        console.error('❌ Edge function error:', error);
        throw new Error(`Edge function error: ${error.message || 'Unknown error'}`);
      }

      if (!data?.authUrl) {
        console.error('❌ No auth URL received:', data);
        throw new Error('No authorization URL received from server');
      }

      console.log('🔗 Auth URL received:', data.authUrl);
      console.log('🚀 Click here to authorize manually if redirect fails:', data.authUrl);
      
      // Enhanced redirect handling
      try {
        console.log('🔄 Attempting automatic redirect...');
        
        // Set a timeout to catch redirect failures
        setTimeout(() => {
          console.log('⚠️ Redirect may have failed. Try the manual link above.');
          toast.error('Automatic redirect failed. Please check the console for a manual link.');
        }, 2000);
        
        window.location.href = data.authUrl;
        
      } catch (redirectError) {
        console.error('❌ Automatic redirect failed:', redirectError);
        console.log('🔗 Please click this link manually:', data.authUrl);
        
        // Try opening in same window
        window.open(data.authUrl, '_self');
        
        toast.error('Please check the browser console for the authorization link and click it manually.');
      }
      
    } catch (error) {
      console.error('❌ Connection error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to connect to OneDrive: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const exchangeCodeForToken = async (code: string, organizationId: string) => {
    try {
      toast.info('Connecting to OneDrive...');
      
      const { data, error } = await supabase.functions.invoke('onedrive-sync', {
        body: {
          action: 'exchange_code',
          code,
          organizationId,
        },
      });

      if (error) throw error;

      toast.success('OneDrive connected successfully!');
      await checkConnection();
    } catch (error) {
      console.error('Token exchange error:', error);
      toast.error('Failed to connect to OneDrive');
    }
  };

  const syncFiles = async () => {
    if (!connection) return;

    setIsSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('onedrive-sync', {
        body: {
          action: 'sync_files',
          connectionId: connection.id,
        },
      });

      if (error) throw error;

      toast.success('Files synced successfully!');
      await checkConnection();
      await loadFiles();
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Failed to sync files');
    } finally {
      setIsSyncing(false);
    }
  };

  const disconnect = async () => {
    if (!connection) return;

    try {
      const { error } = await supabase.functions.invoke('onedrive-sync', {
        body: {
          action: 'disconnect',
          connectionId: connection.id,
        },
      });

      if (error) throw error;

      toast.success('OneDrive disconnected');
      setConnection(null);
      setFiles([]);
    } catch (error) {
      console.error('Disconnect error:', error);
      toast.error('Failed to disconnect');
    }
  };

  if (!connection) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CloudOff className="h-5 w-5" />
            OneDrive Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <AlertDescription>
              Connect your OneDrive to automatically import projects based on your business files.
              Files will be parsed to extract client and project information.
            </AlertDescription>
          </Alert>
          <div className="space-y-2">
            <Button onClick={connectToOneDrive} disabled={isLoading} className="w-full">
              {isLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Cloud className="h-4 w-4 mr-2" />
              )}
              Connect OneDrive
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              If the automatic redirect doesn't work, check browser console for the manual authorization link.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-green-600" />
            OneDrive Connected
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Folder: {connection.folder_path}
              </p>
              {connection.last_sync_at && (
                <p className="text-sm text-muted-foreground">
                  Last sync: {new Date(connection.last_sync_at).toLocaleString()}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={syncFiles} disabled={isSyncing} size="sm">
                {isSyncing ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sync Now
              </Button>
              <Button onClick={disconnect} variant="outline" size="sm">
                <CloudOff className="h-4 w-4 mr-2" />
                Disconnect
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent OneDrive Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{file.file_name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {file.file_type}
                      </Badge>
                    </div>
                    {(file.parsed_client_name || file.parsed_project_name) && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {file.parsed_client_name && (
                          <span className="mr-2">Client: {file.parsed_client_name}</span>
                        )}
                        {file.parsed_project_name && (
                          <span>Project: {file.parsed_project_name}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={file.sync_status === 'synced' ? 'default' : 'secondary'}
                    >
                      {file.sync_status}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => window.open(file.web_url, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}