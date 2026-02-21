import axios from 'axios';
import FormData from 'form-data';

/**
 * Upload a file buffer to IPFS via Pinata
 */
export const uploadFileBuffer = async (buffer: Buffer, filename: string, contentType: string): Promise<string> => {
    try {
        const formData = new FormData();
        formData.append('file', buffer, {
            filename: filename,
            contentType: contentType
        });

        const pinataMetadata = JSON.stringify({
            name: filename,
        });
        formData.append('pinataMetadata', pinataMetadata);

        const pinataOptions = JSON.stringify({
            cidVersion: 0,
        });
        formData.append('pinataOptions', pinataOptions);

        const res = await axios.post("https://api.pinata.cloud/pinning/pinFileToIPFS", formData, {
            headers: {
                'Authorization': `Bearer ${process.env.PINATA_JWT}`,
                ...formData.getHeaders()
            },
        });

        return `https://gateway.pinata.cloud/ipfs/${res.data.IpfsHash}`;
    } catch (error) {
        console.error('Error uploading file to IPFS:', error);
        throw new Error('Failed to upload file to IPFS');
    }
};

/**
 * Upload JSON metadata to IPFS via Pinata
 */
export const uploadJSON = async (json: any, name: string): Promise<string> => {
    try {
        const res = await axios.post("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
            pinataContent: json,
            pinataMetadata: {
                name: name
            }
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.PINATA_JWT}`,
                'Content-Type': 'application/json'
            },
        });

        return `https://gateway.pinata.cloud/ipfs/${res.data.IpfsHash}`;
    } catch (error) {
        console.error('Error uploading JSON to IPFS:', error);
        throw new Error('Failed to upload metadata to IPFS');
    }
};

// Legacy method wrapper
export const uploadToIPFS = async (file: Express.Multer.File): Promise<string> => {
    return uploadFileBuffer(file.buffer, file.originalname, file.mimetype);
};

/**
 * Fetch JSON from IPFS HTTP Gateway
 */
export const getJSON = async (url: string): Promise<string> => {
    try {
        const res = await axios.get(url);
        return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    } catch (error) {
        console.error('Error fetching JSON from IPFS:', error);
        throw new Error('Failed to fetch JSON from IPFS');
    }
};
