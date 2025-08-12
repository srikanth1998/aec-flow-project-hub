import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

interface OneDriveFile {
  id: string;
  name: string;
  webUrl: string;
  '@microsoft.graph.downloadUrl'?: string;
  size: number;
  lastModifiedDateTime: string;
  parentReference: {
    path: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { action, code, organizationId, connectionId } = await req.json();
    
    console.log(`OneDrive sync action: ${action}`);

    switch (action) {
      case 'get_auth_url': {
        const clientId = Deno.env.get('MICROSOFT_CLIENT_ID');
        const tenantId = Deno.env.get('MICROSOFT_TENANT_ID') || 'common';
        const redirectUri = `${req.headers.get('origin')}/`;
        
        const scopes = encodeURIComponent('Files.Read Files.Read.All Sites.Read.All offline_access');
        const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scopes}&state=${organizationId}`;
        
        return new Response(JSON.stringify({ authUrl }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'exchange_code': {
        const clientId = Deno.env.get('MICROSOFT_CLIENT_ID');
        const clientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET');
        const tenantId = Deno.env.get('MICROSOFT_TENANT_ID') || 'common';
        const redirectUri = `${req.headers.get('origin')}/`;

        const tokenResponse = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: clientId!,
            client_secret: clientSecret!,
            code: code,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }),
        });

        if (!tokenResponse.ok) {
          throw new Error(`Token exchange failed: ${await tokenResponse.text()}`);
        }

        const tokens: TokenResponse = await tokenResponse.json();
        
        // Store connection in database
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
        
        const { data: connection, error } = await supabase
          .from('onedrive_connections')
          .upsert({
            organization_id: organizationId,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_expires_at: expiresAt,
            sync_enabled: true,
          })
          .select()
          .single();

        if (error) throw error;

        // Trigger initial sync
        await syncFiles(supabase, connection.id, tokens.access_token);

        return new Response(JSON.stringify({ success: true, connection }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'sync_files': {
        const { data: connection, error: connError } = await supabase
          .from('onedrive_connections')
          .select('*')
          .eq('id', connectionId)
          .single();

        if (connError || !connection) {
          throw new Error('Connection not found');
        }

        await syncFiles(supabase, connectionId, connection.access_token);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'disconnect': {
        const { error } = await supabase
          .from('onedrive_connections')
          .update({ 
            access_token: null, 
            refresh_token: null, 
            sync_enabled: false 
          })
          .eq('id', connectionId);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        throw new Error('Invalid action');
    }
  } catch (error) {
    console.error('OneDrive sync error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function syncFiles(supabase: any, connectionId: string, accessToken: string) {
  console.log('Starting file sync...');
  
  // Get connection details
  const { data: connection } = await supabase
    .from('onedrive_connections')
    .select('*')
    .eq('id', connectionId)
    .single();

  if (!connection) return;

  const folderPath = connection.folder_path || '/Documents/BusinessDocs';
  
  try {
    // Get files from OneDrive
    const filesResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:${folderPath}:/children`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!filesResponse.ok) {
      throw new Error(`Failed to fetch files: ${await filesResponse.text()}`);
    }

    const filesData = await filesResponse.json();
    const files: OneDriveFile[] = filesData.value || [];

    console.log(`Found ${files.length} files in OneDrive`);

    // Process each file
    for (const file of files) {
      // Parse file name to extract client and project info
      const parsedInfo = parseFileName(file.name);
      
      // Check if file already exists in our database
      const { data: existingFile } = await supabase
        .from('onedrive_files')
        .select('*')
        .eq('onedrive_file_id', file.id)
        .single();

      const fileData = {
        organization_id: connection.organization_id,
        onedrive_file_id: file.id,
        file_name: file.name,
        file_path: `${folderPath}/${file.name}`,
        web_url: file.webUrl,
        download_url: file['@microsoft.graph.downloadUrl'],
        file_size: file.size,
        modified_at: file.lastModifiedDateTime,
        parsed_client_name: parsedInfo.clientName,
        parsed_project_name: parsedInfo.projectName,
        file_type: getFileType(file.name),
        sync_status: 'synced',
      };

      if (existingFile) {
        // Update existing file
        await supabase
          .from('onedrive_files')
          .update(fileData)
          .eq('id', existingFile.id);
      } else {
        // Insert new file
        await supabase
          .from('onedrive_files')
          .insert(fileData);
      }

      // Try to create/update project if we have enough info
      if (parsedInfo.clientName && parsedInfo.projectName) {
        await createOrUpdateProject(supabase, connection.organization_id, parsedInfo, file);
      }
    }

    // Update last sync time
    await supabase
      .from('onedrive_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connectionId);

    console.log('File sync completed successfully');
  } catch (error) {
    console.error('Sync error:', error);
    throw error;
  }
}

function parseFileName(fileName: string): { clientName?: string; projectName?: string } {
  // Remove file extension
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
  
  // Common patterns:
  // "Client Name - Project Name"
  // "ClientName_ProjectName"  
  // "ClientName ProjectName"
  // "Invoice_ClientName_ProjectName_Date"
  // "Proposal - Client Name - Project Name"
  
  let clientName: string | undefined;
  let projectName: string | undefined;

  // Pattern 1: Contains "Invoice" or "Proposal" at the start
  if (/^(invoice|proposal)/i.test(nameWithoutExt)) {
    const parts = nameWithoutExt.split(/[-_\s]+/);
    if (parts.length >= 3) {
      clientName = parts[1]?.trim();
      projectName = parts[2]?.trim();
    }
  }
  // Pattern 2: Simple "Client - Project" or "Client_Project"
  else if (nameWithoutExt.includes('-') || nameWithoutExt.includes('_')) {
    const separator = nameWithoutExt.includes('-') ? '-' : '_';
    const parts = nameWithoutExt.split(separator);
    if (parts.length >= 2) {
      clientName = parts[0]?.trim();
      projectName = parts.slice(1).join(' ').trim();
    }
  }
  // Pattern 3: Space separated (assume first two words are client, rest is project)
  else {
    const words = nameWithoutExt.split(/\s+/);
    if (words.length >= 2) {
      clientName = words.slice(0, 2).join(' ');
      projectName = words.slice(2).join(' ') || words[1];
    }
  }

  return {
    clientName: clientName && clientName.length > 0 ? clientName : undefined,
    projectName: projectName && projectName.length > 0 ? projectName : undefined,
  };
}

function getFileType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  
  const typeMap: { [key: string]: string } = {
    pdf: 'PDF Document',
    doc: 'Word Document',
    docx: 'Word Document',
    xls: 'Excel Spreadsheet',
    xlsx: 'Excel Spreadsheet',
    ppt: 'PowerPoint Presentation',
    pptx: 'PowerPoint Presentation',
    txt: 'Text File',
    jpg: 'Image',
    jpeg: 'Image',
    png: 'Image',
    gif: 'Image',
    zip: 'Archive',
    rar: 'Archive',
  };

  return typeMap[extension] || 'Unknown';
}

async function createOrUpdateProject(
  supabase: any, 
  organizationId: string, 
  parsedInfo: { clientName?: string; projectName?: string },
  file: OneDriveFile
) {
  if (!parsedInfo.clientName || !parsedInfo.projectName) return;

  // Check if project already exists
  const { data: existingProject } = await supabase
    .from('projects')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('client_name', parsedInfo.clientName)
    .eq('name', parsedInfo.projectName)
    .single();

  if (!existingProject) {
    // Create new project
    const { error } = await supabase
      .from('projects')
      .insert({
        organization_id: organizationId,
        name: parsedInfo.projectName,
        client_name: parsedInfo.clientName,
        description: `Auto-imported from OneDrive file: ${file.name}`,
        project_type: 'residential', // Default type
        status: 'planning',
        created_by: organizationId, // Use org ID as fallback
      });

    if (error) {
      console.error('Failed to create project:', error);
    } else {
      console.log(`Created new project: ${parsedInfo.projectName} for ${parsedInfo.clientName}`);
    }
  }
}