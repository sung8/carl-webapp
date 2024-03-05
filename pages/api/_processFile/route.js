import { NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'
import { TextLoader } from 'langchain/document_loaders/fs/text'
import { DirectoryLoader } from 'langchain/document_loaders/fs/directory'
import { PDFLoader } from 'langchain/document_loaders/fs/pdf'
import { UnstructuredLoader } from 'langchain/document_loaders/fs/unstructured'
// import {
//   createPineconeIndex,
//   updatePinecone,
// } from '../../_utils/pineconeUtils.js'
import { indexName, timeout } from '../../../pineconeConfig.js'
import { OpenAIEmbeddings } from 'langchain/embeddings/openai.js'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter.js'
// import fetch from 'node-fetch'

export async function POST(req) {
  try {
    const { fileUrl } = await req.json()

    // Fetch the file content from the provided URL
    const fileContent = await fetch(fileUrl).then(res => res.text())

    // Pass the fileUrl to the DirectoryLoader
    const loader = new DirectoryLoader(
      fileUrl, // Pass the file content as fileUrl
      {
        '.txt': path => new TextLoader(path),
        '.md': path => new TextLoader(path),
        '.pdf': path => new PDFLoader(path),
        '.png': path => new UnstructuredLoader(path),
        '.jpg': path => new UnstructuredLoader(path),
      },
    )

    const docs = await loader.load()
    const vectorDimensions = 1536

    const client = new Pinecone({ apiKey: process.env.PINECONE_API_KEY })

    // Create Pinecone index and update with docs
    await createPineconeIndex(client, indexName, vectorDimensions)
    await updatePinecone(client, indexName, docs)

    return NextResponse.json({
      data: 'Successfully created index and loaded data into Pinecone.',
    })
  } catch (error) {
    console.error('Error processing file:', error)
  }
}

const createPineconeIndex = async (client, indexName, vectorDimension) => {
  // 1. Initiate index existence check
  console.log(`Checking "${indexName}"...`)
  // 2. Get list of existing indexes
  const existingIndexes = await client.listIndexes()
  // 3. If index doesn't exist, create it
  if (!existingIndexes.includes(indexName)) {
    // 4. Log index creation initiation
    console.log(`Creating "${indexName}"...`)
    // 5. Create index
    await client.createIndex({
      createRequest: {
        name: indexName,
        dimension: vectorDimension,
        metric: 'cosine',
      },
    })
    // 6. Log successful creation
    console.log(`Creating index.... please wait for it to finish initializing.`)
    // 7. Wait for index initialization
    await new Promise(resolve => setTimeout(resolve, timeout))
  } else {
    // 8. Log if index already exists
    console.log(`"${indexName}" already exists.`)
  }
}

const updatePinecone = async (client, indexName, docs) => {
  console.log('Retrieving Pinecone index...')
  // 1. Retrieve Pinecone index
  const index = client.Index(indexName)
  // 2. Log the retrieved index name
  console.log(`Pinecone index retrieved: ${indexName}`)
  // 3. Process each document in the docs array
  for (const doc of docs) {
    console.log(`Processing document: ${doc.metadata.source}`)
    const txtPath = doc.metadata.source
    const text = doc.pageContent
    // 4. Create RecursiveCharacterTextSplitter instance
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
    })
    console.log('Splitting text into chunks...')
    // 5. Split text into chunks (documents)
    const chunks = await textSplitter.createDocuments([text])
    console.log(`Text split into ${chunks.length} chunks`)
    console.log(
      `Calling OpenAI's Embedding endpoint documents with ${chunks.length} text chunks ...`,
    )
    // 6. Create OpenAI embeddings for documents
    const embeddingsArrays = await new OpenAIEmbeddings().embedDocuments(
      chunks.map(chunk => chunk.pageContent.replace(/\n/g, ' ')),
    )
    console.log('Finished embedding documents')
    console.log(
      `Creating ${chunks.length} vectors array with id, values, and metadata...`,
    )
    // 7. Create and upsert vectors in batches of 100
    const batchSize = 100
    let batch = []
    for (let idx = 0; idx < chunks.length; idx++) {
      const chunk = chunks[idx]
      const vector = {
        id: `${txtPath}_${idx}`,
        values: embeddingsArrays[idx],
        metadata: {
          ...chunk.metadata,
          loc: JSON.stringify(chunk.metadata.loc),
          pageContent: chunk.pageContent,
          txtPath: txtPath,
        },
      }
      batch = [...batch, vector]
      // When batch is full or it's the last item, upsert the vectors
      if (batch.length === batchSize || idx === chunks.length - 1) {
        await index.upsert({
          upsertRequest: {
            vectors: batch,
          },
        })
        // Empty the batch
        batch = []
      }
    }
    // 8. Log the number of vectors updated
    console.log(`Pinecone index updated with ${chunks.length} vectors`)
  }
}
