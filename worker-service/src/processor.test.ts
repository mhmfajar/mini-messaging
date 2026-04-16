import { describe, it, expect, mock, beforeEach } from "bun:test";

// Mock dependencies before importing processor
const mockUpdate = mock(() => Promise.resolve({}));
const mockFindUnique = mock(() =>
  Promise.resolve({
    id: "msg-1",
    senderId: "s1",
    message: "Hi",
    sender: { id: "s1", name: "Alice", phone: "111" },
  }),
);

mock.module("./prisma", () => ({
  prisma: {
    message: {
      update: mockUpdate,
      findUnique: mockFindUnique,
    },
  },
}));

const mockPublishStatus = mock(() => Promise.resolve());
const mockPublishNew = mock(() => Promise.resolve());

mock.module("./redis-publisher", () => ({
  publishStatusUpdate: mockPublishStatus,
  publishNewMessage: mockPublishNew,
}));

// Import after mocks
const { processMessage } = await import("./processor");

describe("processMessage", () => {
  beforeEach(() => {
    mockUpdate.mockClear();
    mockFindUnique.mockClear();
    mockPublishStatus.mockClear();
    mockPublishNew.mockClear();
  });

  it("should update status to processing first", async () => {
    await processMessage({
      id: "msg-1",
      senderId: "s1",
      receiverId: "r1",
      message: "Hello",
    });

    // First call should be status → processing
    expect(mockUpdate).toHaveBeenCalled();
    const firstCall = mockUpdate.mock.calls[0];
    expect(firstCall[0]).toEqual({
      where: { id: "msg-1" },
      data: { status: "processing" },
    });
  });

  it("should publish processing status update", async () => {
    await processMessage({
      id: "msg-1",
      senderId: "s1",
      receiverId: "r1",
      message: "Hello",
    });

    // First publish should be "processing"
    expect(mockPublishStatus.mock.calls[0][0]).toBe("msg-1");
    expect(mockPublishStatus.mock.calls[0][1]).toBe("processing");
  });

  it("should update status to a final state (sent or failed)", async () => {
    await processMessage({
      id: "msg-1",
      senderId: "s1",
      receiverId: "r1",
      message: "Hello",
    });

    // Second update call should be the final status
    expect(mockUpdate.mock.calls.length).toBe(2);
    const finalStatus = mockUpdate.mock.calls[1][0].data.status;
    expect(["sent", "failed"]).toContain(finalStatus);
  });

  it("should publish the final status update", async () => {
    await processMessage({
      id: "msg-1",
      senderId: "s1",
      receiverId: "r1",
      message: "Hello",
    });

    // At least 2 status publishes: processing + final
    expect(mockPublishStatus.mock.calls.length).toBe(2);
    const finalStatus = mockPublishStatus.mock.calls[1][1];
    expect(["sent", "failed"]).toContain(finalStatus);
  });

  it("should return a boolean indicating success", async () => {
    const result = await processMessage({
      id: "msg-1",
      senderId: "s1",
      receiverId: "r1",
      message: "Hello",
    });

    expect(typeof result).toBe("boolean");
  });

  it("should throw on database error", async () => {
    mockUpdate.mockRejectedValueOnce(new Error("DB connection failed"));

    await expect(
      processMessage({
        id: "msg-1",
        senderId: "s1",
        receiverId: "r1",
        message: "Hello",
      }),
    ).rejects.toThrow("DB connection failed");
  });
});
