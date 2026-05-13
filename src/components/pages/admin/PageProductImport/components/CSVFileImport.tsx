import React from "react";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import axios from "axios";

type CSVFileImportProps = {
  url: string;
  title: string;
};

export default function CSVFileImport({ url, title }: CSVFileImportProps) {
  const [file, setFile] = React.useState<File>();
  const [isUploading, setIsUploading] = React.useState(false);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setFile(file);
    }
  };

  const removeFile = () => {
    setFile(undefined);
  };

  const uploadFile = async () => {
    if (!file) {
      return;
    }

    setIsUploading(true);

    try {
      const response = await axios.get<string>(url, {
        params: {
          name: file.name,
        },
      });

      const uploadResponse = await fetch(response.data, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type || "text/csv",
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed with status ${uploadResponse.status}`);
      }

      setFile(undefined);
    } finally {
      setIsUploading(false);
    }
  };
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      {!file ? (
        <input type="file" accept=".csv,text/csv" onChange={onFileChange} />
      ) : (
        <div>
          <button onClick={removeFile} disabled={isUploading}>
            Remove file
          </button>
          <button onClick={uploadFile} disabled={isUploading}>
            {isUploading ? "Uploading..." : "Upload file"}
          </button>
        </div>
      )}
    </Box>
  );
}
